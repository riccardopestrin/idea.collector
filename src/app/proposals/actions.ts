"use server";

import { refresh } from "next/cache";

import { anthropicClient } from "@/lib/ai/anthropic";
import { evaluateWithClaude, stubScores } from "@/lib/ai/evaluateProposal";
import { buildRepoDigest } from "@/lib/github/repoDigest";
import { getGithubSettings } from "@/lib/github/settings";
import { getProfile } from "@/lib/profiles";
import { isProposalStatus } from "@/lib/proposals";
import { supabaseServer } from "@/lib/supabase/server";

type ActionResult = { error: string } | null;

// Sposta una proposta in un nuovo stato. Aperto a tutti i membri (rettifica
// ADR-0002): l'accountability è la history, non i permessi. La RPC move_proposal
// (migration 0005) fa update + insert history in transazione, con compare-and-set
// su fromStatus: una mossa basata su una board stale fallisce invece di
// sovrascrivere quella di un altro.
export async function updateProposalStatus(
  proposalId: string,
  fromStatus: string,
  toStatus: string,
): Promise<ActionResult> {
  if (!isProposalStatus(fromStatus) || !isProposalStatus(toStatus)) {
    return { error: "Stato non valido." };
  }
  if (fromStatus === toStatus) return null;

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const { data: moved, error } = await supabase.rpc("move_proposal", {
    p_id: proposalId,
    p_from: fromStatus,
    p_to: toStatus,
  });
  if (error) {
    console.error("updateProposalStatus:", error);
    return { error: "Errore nel salvataggio. Riprova." };
  }
  if (!moved) {
    return { error: "La proposta è stata spostata da qualcun altro. Ricarica la pagina." };
  }

  refresh();
  return null;
}

// Valuta una proposta con Claude sul contesto del repo collegato (RFC-003).
// Admin-only. Usata dall'auto-trigger (move admin in in_valutazione) e dal
// "Rilancia". Il fallimento non è mai bloccante: marca `fallita` e ritorna
// l'errore; il move resta valido. force=true (Rilancia) salta l'idempotenza.
export async function evaluateProposal(
  proposalId: string,
  force = false,
): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };
  if ((await getProfile(supabase, user.id))?.role !== "admin") {
    return { error: "Solo un admin può lanciare la valutazione AI." };
  }

  const { data: proposal } = await supabase
    .from("proposals")
    .select("title, description, problem, links, method, ai_generated, manually_edited")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: "Proposta non trovata." };

  // Idempotenza: se già valutata dall'AI e non toccata a mano, l'auto-trigger salta.
  if (!force && proposal.ai_generated && !proposal.manually_edited) return null;

  // force (Rilancia) bypassa anche il guard in-flight della RPC: recupera le
  // valutazioni rimaste 'in_corso' per un crash tra begin e fail (migration 0011).
  const { data: began, error: beginError } = await supabase.rpc("begin_ai_evaluation", {
    p_id: proposalId,
    p_force: force,
  });
  if (beginError) {
    console.error("evaluateProposal begin:", beginError);
    return { error: "Errore nell'avvio della valutazione. Riprova." };
  }
  if (!began) {
    // senza force: già in corso, una sola valutazione in-flight. Con force può
    // essere solo una proposta sparita nel frattempo.
    return force ? { error: "Proposta non trovata." } : null;
  }

  // il refresh qui rende visibile 'in_corso' agli altri client; chi ha lanciato
  // l'azione vede l'aggiornamento solo al ritorno dell'azione (limite di Next)
  refresh();

  try {
    const settings = await getGithubSettings(supabase);
    if (!settings?.github_installation_id || !settings.github_owner || !settings.github_repo) {
      throw new Error("Collega GitHub e scegli la repo nel profilo.");
    }
    const digest = await buildRepoDigest(
      settings.github_installation_id,
      settings.github_owner,
      settings.github_repo,
    );
    // ponytail: AI_EVAL_FAKE=1 salta Claude (demo senza crediti); il digest
    // GitHub viene comunque costruito così il resto della pipeline è reale.
    const scores =
      process.env.AI_EVAL_FAKE === "1"
        ? stubScores(proposal.method)
        : await evaluateWithClaude(anthropicClient(), proposal, digest);
    const { error: applyError } = await supabase.rpc("apply_ai_evaluation", {
      p_id: proposalId,
      p_reach: scores.reach,
      p_impact: scores.impact,
      p_confidence: scores.confidence,
      p_effort: scores.effort,
      p_rationale: scores.rationale,
    });
    if (applyError) throw new Error(applyError.message);
    refresh();
    return null;
  } catch (err) {
    const message = err instanceof Error ? err.message : "errore sconosciuto";
    console.error("evaluateProposal:", err);
    await supabase.rpc("fail_ai_evaluation", { p_id: proposalId, p_error: message });
    refresh();
    return { error: `Valutazione fallita: ${message}` };
  }
}

// Aggiunge un commento a una proposta. Qualsiasi membro autenticato può
// commentare; la policy "author insert" (0009) è il backstop sul chi.
// proposalId arriva via bind dal pannello; (prev, formData) da useActionState.
export async function addComment(
  proposalId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "Il commento non può essere vuoto." };
  if (body.length > 4000) return { error: "Commento troppo lungo (max 4000 caratteri)." };

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const { error } = await supabase
    .from("comments")
    .insert({ proposal_id: proposalId, author_id: user.id, body });
  if (error) {
    console.error("addComment:", error);
    return { error: "Errore nel salvataggio. Riprova." };
  }

  refresh();
  return null;
}

// Elimina una proposta. Solo l'autore o un admin (rettifica ADR-0002); il guard
// qui è il livello applicativo, la policy "owner or admin delete" è il backstop.
// La conferma (con l'alternativa "sposta in Rifiutata") vive nella UI.
export async function deleteProposal(proposalId: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("proposer_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: "Proposta non trovata." };

  if (
    proposal.proposer_id !== user.id &&
    (await getProfile(supabase, user.id))?.role !== "admin"
  ) {
    return { error: "Solo l'autore o un admin può eliminare la proposta." };
  }

  const { error } = await supabase.from("proposals").delete().eq("id", proposalId);
  if (error) {
    console.error("deleteProposal:", error);
    return { error: "Errore nell'eliminazione. Riprova." };
  }

  refresh();
  return null;
}
