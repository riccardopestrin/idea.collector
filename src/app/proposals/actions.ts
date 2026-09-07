"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { refresh } from "next/cache";

import { canMoveTo } from "@/lib/board";
import { runEvaluation } from "@/lib/ai/runEvaluation";
import { runProposalScan } from "@/lib/ai/runProposalScan";
import { isAnchorField, markdownToPlainText, resolveAnchor } from "@/lib/anchors";
import {
  isOpenProposalStatus,
  isProposalStatus,
  type PromotionStatus,
  type ProposalStatus,
} from "@/lib/proposals";
import { isProjectAdmin } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";
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
    return { error: STRINGS.board.invalidStatus };
  }
  if (fromStatus === toStatus) return null;
  // Macchina a stati (branch cardDirections): guard qui per il messaggio; il
  // backstop è in move_proposal (migration 0018).
  if (!canMoveTo(fromStatus, toStatus)) {
    return { error: STRINGS.board.moveNotAllowed };
  }

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  // La lettura passa dalla RLS "member read" (0021): per un non-membro la
  // proposta non esiste. move_proposal (0022) è il backstop a DB.
  const { data: proposal } = await supabase
    .from("proposals")
    .select("dup_flagged")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };

  // RFC-006: una proposta flaggata come possibile duplicato non avanza — gate
  // sullo stato del flag, qualunque sia lo stato di partenza. Resta libera solo
  // 'rifiutata' (l'uscita di scarto): lo sblocco avviene editando l'idea mentre
  // è in 'nuova' (abbassa la similarità), non muovendola. 'nuova' non è più un
  // target raggiungibile dalla macchina a stati (canMoveTo l'ha già scartato
  // sopra): la clausa resta solo per simmetria col gemello move_proposal
  // (migration 0018). Guard qui per il messaggio chiaro; move_proposal è il backstop.
  if (toStatus !== "rifiutata" && toStatus !== "nuova" && proposal.dup_flagged) {
    return { error: STRINGS.board.dupBlocked };
  }

  const { data: moved, error } = await supabase.rpc("move_proposal", {
    p_id: proposalId,
    p_from: fromStatus,
    p_to: toStatus,
  });
  if (error) {
    console.error("updateProposalStatus:", error);
    return { error: STRINGS.errors.saveFailed };
  }
  if (!moved) {
    return { error: STRINGS.board.movedByOther };
  }

  refresh();
  return null;
}

// Valuta una proposta con Claude sul contesto del repo collegato (RFC-003).
// Admin-only. Usata dall'auto-trigger (move admin in in_valutazione) e dal
// "Rilancia". Il fallimento non è mai bloccante: marca `fallita` sulla riga;
// il move resta valido. force=true (Rilancia) salta l'idempotenza.
export async function evaluateProposal(
  proposalId: string,
  force = false,
): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("project_id")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };
  if (!(await isProjectAdmin(supabase, proposal.project_id, user.id))) {
    return { error: STRINGS.evaluation.adminOnly };
  }

  return runEvaluation(supabase, proposalId, force);
}

// Scan anti-duplicato + competitor web (RFC-006). Proposer o admin; usata
// dall'auto-trigger on-view (ProposalScanTrigger) e dal "Rilancia scansione".
// Il fallimento non è mai bloccante: marca 'fallita' sulla riga.
// force=true salta l'idempotenza (Rilancia, re-scan su edit).
export async function runProposalScanAction(
  proposalId: string,
  force = false,
): Promise<ActionResult> {
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
    return { error: STRINGS.evaluation.scanAuth };
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
  if (!body) return { error: STRINGS.comments.emptyBody };
  if (body.length > 4000) return { error: STRINGS.comments.tooLong };

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("status, description, problem")
    .eq("id", proposalId)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };
  if (proposal.status !== "nuova" && proposal.status !== "in_valutazione") {
    return { error: STRINGS.comments.closed };
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
      return { error: STRINGS.comments.anchorInvalid };
    }
    const fieldText = proposal[anchorField];
    const resolved =
      fieldText &&
      resolveAnchor(markdownToPlainText(fieldText), {
        text: anchorText,
        occurrence: anchorOccurrence,
      });
    if (!resolved) {
      return { error: STRINGS.comments.anchorStale };
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
    return { error: STRINGS.errors.saveFailed };
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
  proposal: { status: ProposalStatus; proposer_id: string; project_id: string };
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
  if (!comment) return { error: STRINGS.errors.commentNotFound };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("status, proposer_id, project_id")
    .eq("id", comment.proposal_id)
    .maybeSingle();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };
  return { comment, proposal };
}

// Modifica il testo di un commento: solo il creatore, solo su proposta aperta
// (cristallizzazione, coerente con addComment). L'ancora resta invariata (il
// grant di colonna di 0014 permette solo `body`).
export async function editComment(
  commentId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: STRINGS.comments.emptyBody };
  if (body.length > 4000) return { error: STRINGS.comments.tooLong };

  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const ctx = await commentContext(supabase, commentId);
  if ("error" in ctx) return ctx;
  if (ctx.comment.author_id !== user.id) return { error: STRINGS.comments.editOnlyOwn };
  if (!isOpenProposalStatus(ctx.proposal.status)) {
    return { error: STRINGS.comments.mutationsClosed };
  }

  const { error } = await supabase.from("comments").update({ body }).eq("id", commentId);
  if (error) {
    console.error("editComment:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  refresh();

  // Il testo di un contributo accepted è parte dell'idea (live): un edit vero
  // rilancia l'eval, come updateProposal. Autorizzazione = il guard sopra (solo
  // l'autore); la scrittura gira come service_role (0020), nessun backstop DB.
  if (
    ctx.comment.promotion_status === "accepted" &&
    ctx.proposal.status === "in_valutazione" &&
    body !== ctx.comment.body
  ) {
    await runEvaluation(supabase, ctx.comment.proposal_id, true);
  }
  return null;
}

// Elimina un commento: l'autore, o un admin (pieni poteri); solo su proposta aperta.
export async function deleteComment(commentId: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  // autore, oppure admin (policy "admin delete open", migration 0020)
  const ctx = await commentContext(supabase, commentId);
  if ("error" in ctx) return ctx;
  if (
    ctx.comment.author_id !== user.id &&
    !(await isProjectAdmin(supabase, ctx.proposal.project_id, user.id))
  ) {
    return { error: STRINGS.comments.deleteOnlyOwn };
  }
  if (!isOpenProposalStatus(ctx.proposal.status)) {
    return { error: STRINGS.comments.mutationsClosed };
  }
  // un contributo accepted non si elimina: prima il revoke (policy 0016 backstop)
  if (ctx.comment.promotion_status === "accepted") {
    return { error: STRINGS.comments.revokeBeforeDelete };
  }

  const { error } = await supabase.from("comments").delete().eq("id", commentId);
  if (error) {
    console.error("deleteComment:", error);
    return { error: STRINGS.errors.deleteFailed };
  }

  refresh();
  return null;
}

// --- Promozione commento → contributo (migration 0016) ---
//
// Le transizioni di promotion_status passano solo dalle RPC security definer
// (CAS: false = stato cambiato nel frattempo). Il guard applicativo qui replica
// l'autorizzazione della RPC per dare messaggi puntuali; la RPC è il backstop.

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
    return { error: STRINGS.errors.saveFailed };
  }
  if (!done) return { error: STRINGS.promotion.stale };
  refresh();
  return null;
}

// Candidatura: solo l'autore del proprio commento, mai il proposer dell'idea.
export async function requestCommentPromotion(commentId: string): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const ctx = await commentContext(supabase, commentId);
  if ("error" in ctx) return ctx;
  if (ctx.comment.author_id !== user.id) {
    return { error: STRINGS.promotion.onlyOwn };
  }
  if (ctx.proposal.proposer_id === user.id) {
    return { error: STRINGS.promotion.ownProposal };
  }
  if (!isOpenProposalStatus(ctx.proposal.status)) {
    return { error: STRINGS.promotion.closed };
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
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const ctx = await commentContext(supabase, commentId);
  if ("error" in ctx) return ctx;
  if (
    ctx.proposal.proposer_id !== user.id &&
    !(await isProjectAdmin(supabase, ctx.proposal.project_id, user.id))
  ) {
    return { error: STRINGS.promotion.decideAuth };
  }
  if (!isOpenProposalStatus(ctx.proposal.status)) {
    return { error: STRINGS.promotion.closed };
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
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const ctx = await commentContext(supabase, commentId);
  if ("error" in ctx) return ctx;
  const isAuthor = ctx.comment.author_id === user.id;
  const isProposer = ctx.proposal.proposer_id === user.id;
  const isAdmin =
    !isAuthor && !isProposer && (await isProjectAdmin(supabase, ctx.proposal.project_id, user.id));
  if (!isAuthor && !isProposer && !isAdmin) {
    return { error: STRINGS.promotion.revokeAuth };
  }
  if (!isOpenProposalStatus(ctx.proposal.status)) {
    return { error: STRINGS.promotion.contributionsClosed };
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
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const { data: proposal } = await supabase
    .from("proposals")
    .select("proposer_id, project_id")
    .eq("id", proposalId)
    .single();
  if (!proposal) return { error: STRINGS.errors.proposalNotFound };

  if (
    proposal.proposer_id !== user.id &&
    !(await isProjectAdmin(supabase, proposal.project_id, user.id))
  ) {
    return { error: STRINGS.proposal.deleteAuth };
  }

  const { error } = await supabase.from("proposals").delete().eq("id", proposalId);
  if (error) {
    console.error("deleteProposal:", error);
    return { error: STRINGS.errors.deleteFailed };
  }

  refresh();
  return null;
}
