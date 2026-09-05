"use server";

import { refresh } from "next/cache";

import { runEvaluation } from "@/lib/ai/runEvaluation";
import { runProposalScan } from "@/lib/ai/runProposalScan";
import { parseGitRef } from "@/lib/github/gitRef";
import { getProfile } from "@/lib/profiles";
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
    .select("proposer_id, status, title, description, problem")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };

  if (
    proposal.proposer_id !== user.id &&
    (await getProfile(supabase, user.id))?.role !== "admin"
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

// Collega (o scollega, input vuoto) il branch/PR su cui si lavora (migration
// 0020). Proposer o admin, in qualsiasi stato: non è contenuto dell'idea, quindi
// fuori dalla cristallizzazione. Policy "owner or admin update" come backstop.
export async function setGitRef(
  proposalId: string,
  _prev: UpdateProposalState,
  formData: FormData,
): Promise<UpdateProposalState> {
  const gitRef = parseGitRef(String(formData.get("git_ref") ?? ""));
  if (gitRef === undefined) return { error: STRINGS.proposal.gitRefInvalid };

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("proposer_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };
  if (
    proposal.proposer_id !== user.id &&
    (await getProfile(supabase, user.id))?.role !== "admin"
  ) {
    return { error: STRINGS.proposal.gitRefAuth };
  }

  const { error } = await supabase
    .from("proposals")
    .update({ git_ref: gitRef })
    .eq("id", proposalId);
  if (error) {
    console.error("setGitRef:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  refresh();
  return null;
}
