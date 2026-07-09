"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";

import { runEvaluation } from "@/lib/ai/runEvaluation";
import { runProposalScan } from "@/lib/ai/runProposalScan";
import { isAnchorField, markdownToPlainText, resolveAnchor } from "@/lib/anchors";
import { getProfile } from "@/lib/profiles";
import {
  isOpenProposalStatus,
  isProposalStatus,
  type PromotionStatus,
  type ProposalStatus,
} from "@/lib/proposals";
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

  // RFC-006: una proposta flaggata come possibile duplicato non avanza —
  // gate sullo stato del flag, qualunque sia lo stato di partenza (un gate su
  // fromStatus sarebbe aggirabile via nuova → rifiutata → altrove). Liberi
  // solo Rifiutata e il rientro in Nuova (sblocco/re-scan). Guard qui per il
  // messaggio chiaro; move_proposal (migration 0017) è il backstop.
  if (toStatus !== "rifiutata" && toStatus !== "nuova") {
    const { data: proposal } = await supabase
      .from("proposals")
      .select("dup_flagged")
      .eq("id", proposalId)
      .maybeSingle();
    if (proposal?.dup_flagged) {
      return {
        error:
          "Possibile duplicato: modifica l'idea per differenziarla, oppure spostala in Rifiutata o eliminala.",
      };
    }
  }

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

// Scan anti-duplicato + competitor web (RFC-006). Proposer o admin; usata
// dall'auto-trigger on-view (ProposalScanTrigger) e dal "Rilancia scansione".
// Il fallimento non è mai bloccante: marca 'fallita' e ritorna l'errore.
// force=true salta l'idempotenza (Rilancia, re-scan su edit).
export async function runProposalScanAction(
  proposalId: string,
  force = false,
): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("proposer_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: "Proposta non trovata." };
  if (
    proposal.proposer_id !== user.id &&
    (await getProfile(supabase, user.id))?.role !== "admin"
  ) {
    return { error: "Solo l'autore o un admin può lanciare lo scan duplicati." };
  }

  return runProposalScan(supabase, proposalId, force);
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

// Contesto per le mutazioni su un commento: la coppia commento + proposta che
// serve ai guard applicativi e alle decisioni di re-eval. RLS/RPC è il backstop.
type CommentContext = {
  comment: {
    author_id: string;
    proposal_id: string;
    body: string;
    promotion_status: PromotionStatus;
  };
  proposal: { status: ProposalStatus; proposer_id: string };
};

async function commentContext(
  supabase: SupabaseClient,
  commentId: string,
): Promise<{ error: string } | CommentContext> {
  const { data: comment } = await supabase
    .from("comments")
    .select("author_id, proposal_id, body, promotion_status")
    .eq("id", commentId)
    .maybeSingle();
  if (!comment) return { error: "Commento non trovato." };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("status, proposer_id")
    .eq("id", comment.proposal_id)
    .maybeSingle();
  if (!proposal) return { error: "Proposta non trovata." };
  return { comment, proposal };
}

// Autorizza una mutazione su un commento: solo il creatore, e solo finché la
// proposta è aperta (cristallizzazione, coerente con addComment). notOwnerError
// tiene distinto il messaggio tra modifica ed eliminazione.
async function authorizeCommentMutation(
  supabase: SupabaseClient,
  commentId: string,
  userId: string,
  notOwnerError: string,
): Promise<{ error: string } | CommentContext> {
  const ctx = await commentContext(supabase, commentId);
  if ("error" in ctx) return ctx;
  if (ctx.comment.author_id !== userId) return { error: notOwnerError };
  if (!isOpenProposalStatus(ctx.proposal.status)) {
    return { error: "La proposta non accetta più modifiche." };
  }
  return ctx;
}

// Modifica il testo di un commento. L'ancora resta invariata (il grant di
// colonna di 0014 permette solo `body`).
export async function editComment(
  commentId: string,
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

  const ctx = await authorizeCommentMutation(
    supabase,
    commentId,
    user.id,
    "Puoi modificare solo i tuoi commenti.",
  );
  if ("error" in ctx) return ctx;

  const { error } = await supabase.from("comments").update({ body }).eq("id", commentId);
  if (error) {
    console.error("editComment:", error);
    return { error: "Errore nel salvataggio. Riprova." };
  }

  refresh();

  // Il testo di un contributo accepted è parte dell'idea (live): un edit vero
  // rilancia l'eval, come updateProposal. can_run_ai_evaluation (0016) autorizza
  // l'autore di un contributo accepted.
  if (
    ctx.comment.promotion_status === "accepted" &&
    ctx.proposal.status === "in_valutazione" &&
    body !== ctx.comment.body
  ) {
    await runEvaluation(supabase, ctx.comment.proposal_id, true);
  }
  return null;
}

// Elimina un commento. Stesse regole della modifica.
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const ctx = await authorizeCommentMutation(
    supabase,
    commentId,
    user.id,
    "Puoi eliminare solo i tuoi commenti.",
  );
  if ("error" in ctx) return ctx;
  // un contributo accepted non si elimina: prima il revoke (policy 0016 backstop)
  if (ctx.comment.promotion_status === "accepted") {
    return { error: "Revoca la partecipazione prima di eliminare il contributo." };
  }

  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) {
    console.error("deleteComment:", error);
    return { error: "Errore nell'eliminazione. Riprova." };
  }

  refresh();
  return null;
}

// --- Promozione commento → contributo (migration 0016) ---
//
// Le transizioni di promotion_status passano solo dalle RPC security definer
// (CAS: false = stato cambiato nel frattempo). Il guard applicativo qui replica
// l'autorizzazione della RPC per dare messaggi puntuali; la RPC è il backstop.

const STALE_PROMOTION = "Lo stato del commento è cambiato nel frattempo. Ricarica la pagina.";

// Esito comune delle RPC di promozione: null = transizione avvenuta (con
// refresh); false dal CAS = stato cambiato sotto i piedi.
async function callPromotionRpc(
  supabase: SupabaseClient,
  fn:
    | "request_comment_promotion"
    | "resolve_comment_promotion"
    | "revoke_comment_promotion",
  args: Record<string, unknown>,
): Promise<ActionResult> {
  const { data: done, error } = await supabase.rpc(fn, args);
  if (error) {
    console.error(`${fn}:`, error);
    return { error: "Errore nel salvataggio. Riprova." };
  }
  if (!done) return { error: STALE_PROMOTION };
  refresh();
  return null;
}

// Candidatura: solo l'autore del proprio commento, mai il proposer dell'idea.
export async function requestCommentPromotion(commentId: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const ctx = await commentContext(supabase, commentId);
  if ("error" in ctx) return ctx;
  if (ctx.comment.author_id !== user.id) {
    return { error: "Puoi proporre solo i tuoi commenti." };
  }
  if (ctx.proposal.proposer_id === user.id) {
    return { error: "I tuoi commenti sulla tua proposta non sono promuovibili." };
  }
  if (!isOpenProposalStatus(ctx.proposal.status)) {
    return { error: "La proposta non accetta più promozioni." };
  }

  return callPromotionRpc(supabase, "request_comment_promotion", {
    p_comment_id: commentId,
  });
}

// Accetta o rifiuta una candidatura: proposer o admin. L'accettazione cambia il
// contenuto dell'idea → re-eval AI (non bloccante, come updateProposal). Il
// rifiuto riporta a 'none' (ri-candidabile) e non ricalcola nulla.
export async function resolveCommentPromotion(
  commentId: string,
  accept: boolean,
): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const ctx = await commentContext(supabase, commentId);
  if ("error" in ctx) return ctx;
  if (
    ctx.proposal.proposer_id !== user.id &&
    (await getProfile(supabase, user.id))?.role !== "admin"
  ) {
    return { error: "Solo il proposer o un admin decide sulla promozione." };
  }
  if (!isOpenProposalStatus(ctx.proposal.status)) {
    return { error: "La proposta non accetta più promozioni." };
  }

  const result = await callPromotionRpc(supabase, "resolve_comment_promotion", {
    p_comment_id: commentId,
    p_accept: accept,
  });
  if (result) return result;

  if (accept && ctx.proposal.status === "in_valutazione") {
    await runEvaluation(supabase, ctx.comment.proposal_id, true);
  }
  return null;
}

// Downgrade di un contributo a commento normale: autore, proposer o admin. Il
// voto RICE dell'autore torna a contare da solo (sospensione derivata a lettura).
// Re-eval solo se a revocare è proposer/admin: la pipeline eval gira con la
// sessione del caller e l'autore, appena revocato, non è più autorizzato
// (scelta owner, header migration 0016) — proposer/admin hanno il "Rilancia".
export async function revokeCommentPromotion(commentId: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const ctx = await commentContext(supabase, commentId);
  if ("error" in ctx) return ctx;
  const isAuthor = ctx.comment.author_id === user.id;
  const isProposer = ctx.proposal.proposer_id === user.id;
  const isAdmin =
    !isAuthor && !isProposer && (await getProfile(supabase, user.id))?.role === "admin";
  if (!isAuthor && !isProposer && !isAdmin) {
    return { error: "Solo l'autore, il proposer o un admin può revocare il contributo." };
  }
  if (!isOpenProposalStatus(ctx.proposal.status)) {
    return { error: "La proposta non accetta più modifiche ai contributi." };
  }

  const result = await callPromotionRpc(supabase, "revoke_comment_promotion", {
    p_comment_id: commentId,
  });
  if (result) return result;

  if (ctx.proposal.status === "in_valutazione" && (isProposer || isAdmin)) {
    await runEvaluation(supabase, ctx.comment.proposal_id, true);
  }
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
