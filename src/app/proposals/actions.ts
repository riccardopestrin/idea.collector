"use server";

import { refresh } from "next/cache";

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
