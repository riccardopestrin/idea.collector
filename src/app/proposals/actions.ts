"use server";

import { refresh } from "next/cache";

import { runEvaluation } from "@/lib/ai/runEvaluation";
import { isAnchorField, markdownToPlainText, resolveAnchor } from "@/lib/anchors";
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

  return runEvaluation(supabase, proposalId, force);
}

// Aggiunge un commento a una proposta, eventualmente ancorato a una selezione
// (RFC-004). Qualsiasi membro autenticato può commentare finché la proposta è
// in 'nuova'/'in_valutazione' (cristallizzazione, migration 0013 backstop);
// la policy insert (0009/0013) è il backstop sul chi.
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

  const { data: proposal } = await supabase
    .from("proposals")
    .select("status, description, problem")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: "Proposta non trovata." };
  if (proposal.status !== "nuova" && proposal.status !== "in_valutazione") {
    return { error: "La proposta non accetta più commenti." };
  }

  // Ancora opzionale: field ∈ enum, occurrence ≥ 1, e la quote deve risolversi
  // nel testo corrente della proposta (business rule; il DB valida solo la forma).
  let anchor: Record<string, unknown> = {};
  const anchorField = String(formData.get("anchor_field") ?? "");
  if (anchorField) {
    // il transport del form può normalizzare i newline della quote in CRLF
    const anchorText = String(formData.get("anchor_text") ?? "").replace(/\r\n/g, "\n");
    const anchorOccurrence = Number(formData.get("anchor_occurrence"));
    if (
      !isAnchorField(anchorField) ||
      !anchorText ||
      anchorText.length > 2000 ||
      !Number.isInteger(anchorOccurrence) ||
      anchorOccurrence < 1
    ) {
      return { error: "Ancora del commento non valida." };
    }
    const fieldText = proposal[anchorField];
    const resolved =
      fieldText &&
      resolveAnchor(markdownToPlainText(fieldText), {
        text: anchorText,
        occurrence: anchorOccurrence,
      });
    if (!resolved) {
      return { error: "Il testo selezionato non corrisponde più alla proposta. Ricarica la pagina." };
    }
    anchor = {
      anchor_field: anchorField,
      anchor_text: anchorText,
      anchor_occurrence: anchorOccurrence,
    };
  }

  const { error } = await supabase
    .from("comments")
    .insert({ proposal_id: proposalId, author_id: user.id, body, ...anchor });
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
