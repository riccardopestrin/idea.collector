"use server";

import { refresh } from "next/cache";

import { runEvaluation } from "@/lib/ai/runEvaluation";
import { runProposalScan } from "@/lib/ai/runProposalScan";
import { parseTaskUrl } from "@/lib/clickup/taskUrl";
import { parseGitRef } from "@/lib/github/gitRef";
import { isProjectAdmin } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";
import { parseProposalFields } from "@/lib/validation/proposal";
import { parseVoteFields } from "@/lib/validation/vote";

type UpdateProposalState = { error: string } | null;

// Edit di una proposta (RFC-004 Fase E). Autorizzazione nel service: proposer
// o admin, solo in 'nuova'/'in_valutazione' (trigger di cristallizzazione 0013
// e enforce_proposal_privileged_columns come backstop). In 'in_valutazione' un
// cambio dei campi testuali rilancia la valutazione AI; il fallimento eval non
// fa fallire il save (semantica non bloccante esistente).
export async function updateProposal(
  proposalId: string,
  _prev: UpdateProposalState,
  formData: FormData,
): Promise<UpdateProposalState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const parsed = parseProposalFields(formData);
  if ("error" in parsed) return { error: parsed.error };
  const { fields } = parsed;

  const { data: proposal } = await supabase
    .from("proposals")
    .select("proposer_id, project_id, status, title, description, problem")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };

  if (
    proposal.proposer_id !== user.id &&
    !(await isProjectAdmin(supabase, proposal.project_id, user.id))
  ) {
    return { error: STRINGS.proposal.editAuth };
  }
  if (proposal.status !== "nuova" && proposal.status !== "in_valutazione") {
    return { error: STRINGS.proposal.notEditable };
  }

  const { error } = await supabase
    .from("proposals")
    .update(fields)
    .eq("id", proposalId);
  if (error) {
    console.error("updateProposal:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  refresh();

  // Re-run AI solo se il testo è cambiato davvero: evita chiamate Claude inutili.
  const textChanged =
    fields.title !== proposal.title ||
    fields.description !== proposal.description ||
    fields.problem !== proposal.problem;
  if (proposal.status === "in_valutazione" && textChanged) {
    await runEvaluation(supabase, proposalId, true);
  }
  // RFC-006: in 'nuova' un edit ricalcola la similarità — se scende sotto
  // soglia la proposta si sblocca. Non bloccante: l'esito arriva via cue.
  if (proposal.status === "nuova" && textChanged) {
    await runProposalScan(supabase, proposalId, true);
  }

  return null;
}

// Voto RICE di un utente (migration 0015). Autorizzazione nel service, RLS come
// backstop: solo in 'in_valutazione', mai la propria proposta, un voto solo e
// immutabile (unique + assenza di policy update/delete).
export async function submitRiceVote(
  proposalId: string,
  _prev: UpdateProposalState,
  formData: FormData,
): Promise<UpdateProposalState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("proposer_id, status")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };
  if (proposal.status !== "in_valutazione") {
    return { error: STRINGS.rice.onlyInEvaluation };
  }
  if (proposal.proposer_id === user.id) {
    return { error: STRINGS.rice.ownProposal };
  }
  // Un contributore accettato è co-autore (migration 0016): come per il
  // proposer, niente voto. Guard nel service, policy insert come backstop.
  const { data: contribution } = await supabase
    .from("comments")
    .select("id")
    .eq("proposal_id", proposalId)
    .eq("author_id", user.id)
    .eq("promotion_status", "accepted")
    .limit(1)
    .maybeSingle();
  if (contribution) {
    return { error: STRINGS.rice.contributorCoAuthor };
  }

  const parsed = parseVoteFields(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase
    .from("rice_votes")
    .insert({ proposal_id: proposalId, voter_id: user.id, ...parsed.fields });
  if (error) {
    // 23505 = unique_violation: ha già votato (voto immutabile).
    if (error.code === "23505") return { error: STRINGS.rice.alreadyVoted };
    console.error("submitRiceVote:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  refresh();
  return null;
}

// Collega (o scollega, input vuoto) il branch/PR (migration 0020) o il task
// ClickUp (0026) su cui si lavora. Proposer o admin, in qualsiasi stato: non è
// contenuto dell'idea, quindi fuori dalla cristallizzazione. Policy "owner or
// admin update" come backstop.
export async function setGitRef(
  proposalId: string,
  _prev: UpdateProposalState,
  formData: FormData,
): Promise<UpdateProposalState> {
  const gitRef = parseGitRef(String(formData.get("git_ref") ?? ""));
  if (gitRef === undefined) return { error: STRINGS.proposal.gitRef.invalid };
  return setWorkRef(proposalId, { git_ref: gitRef }, STRINGS.proposal.gitRef.auth);
}

export async function setTaskUrl(
  proposalId: string,
  _prev: UpdateProposalState,
  formData: FormData,
): Promise<UpdateProposalState> {
  const taskUrl = parseTaskUrl(String(formData.get("task_url") ?? ""));
  if (taskUrl === undefined) return { error: STRINGS.proposal.taskUrl.invalid };
  return setWorkRef(proposalId, { task_url: taskUrl }, STRINGS.proposal.taskUrl.auth);
}

async function setWorkRef(
  proposalId: string,
  patch: { git_ref: string | null } | { task_url: string | null },
  authError: string,
): Promise<UpdateProposalState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("proposer_id, project_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };
  if (
    proposal.proposer_id !== user.id &&
    !(await isProjectAdmin(supabase, proposal.project_id, user.id))
  ) {
    return { error: authError };
  }

  const { error } = await supabase.from("proposals").update(patch).eq("id", proposalId);
  if (error) {
    console.error("setWorkRef:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  refresh();
  return null;
}
