"use client";

import { useActionState, useState } from "react";

import {
  deleteComment,
  editComment,
  requestCommentPromotion,
  resolveCommentPromotion,
  revokeCommentPromotion,
} from "@/app/proposals/actions";
import { SectionTitle } from "@/components/detail/SectionTitle";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import { formatDateTime } from "@/lib/dates";
import type { ProposalComment } from "@/lib/proposals";
import { personLabel } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";
import { buttonClass, dangerLinkClass, linkClass, tagClass } from "@/lib/tokens";

import { CommentForm, type PendingAnchor } from "./CommentForm";

// Colonna commenti (RFC-004 Fase C/D): lista + form, con supporto alla
// modalità ancorata (citazione sopra la textarea). Un'ancora che non risolve
// più nel testo corrente mostra il badge "testo modificato". L'hover su un
// commento evidenzia il passaggio citato nel testo (onHoverComment).
export function CommentsSidebar({
  proposalId,
  comments,
  canComment,
  currentUserId,
  proposerId,
  isAdmin,
  pendingAnchor,
  onCancelAnchor,
  onHoverComment,
}: {
  proposalId: string;
  comments: ProposalComment[];
  canComment: boolean;
  currentUserId?: string;
  proposerId: string;
  isAdmin?: boolean;
  pendingAnchor: PendingAnchor | null;
  onCancelAnchor: () => void;
  onHoverComment: (commentId: string | null) => void;
}) {
  const decides = currentUserId === proposerId || isAdmin === true;
  return (
    <aside className="flex flex-col gap-4 border-t border-ink pt-6 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
      <SectionTitle>{STRINGS.comments.heading}</SectionTitle>
      {comments.length === 0 ? (
        <p className="font-mono text-sm text-foreground/60">{STRINGS.comments.empty}</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              // edit solo al creatore, delete anche all'admin; solo su proposta aperta (canComment)
              mine={canComment && comment.author_id === currentUserId}
              canDelete={canComment && (comment.author_id === currentUserId || isAdmin === true)}
              // candidabile solo dal suo autore, mai dal proposer dell'idea
              canPromote={
                canComment &&
                comment.author_id === currentUserId &&
                currentUserId !== proposerId
              }
              // accetta/rifiuta: proposer o admin; revoca: anche l'autore
              canResolve={canComment && decides}
              onHover={onHoverComment}
            />
          ))}
        </ul>
      )}
      {canComment && (
        <CommentForm
          proposalId={proposalId}
          pendingAnchor={pendingAnchor}
          onCancelAnchor={onCancelAnchor}
        />
      )}
    </aside>
  );
}

// Label dei badge di promozione (nessun badge per 'none').
const PROMOTION_BADGES = {
  pending: STRINGS.comments.badgePending,
  accepted: STRINGS.comments.badgeAccepted,
} as const;

function CommentItem({
  comment,
  mine,
  canDelete,
  canPromote,
  canResolve,
  onHover,
}: {
  comment: ProposalComment;
  mine: boolean;
  canDelete: boolean;
  canPromote: boolean;
  canResolve: boolean;
  onHover: (commentId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const accepted = comment.promotion_status === "accepted";
  const promotable = canPromote && comment.promotion_status === "none";
  const resolvable = canResolve && comment.promotion_status === "pending";
  const revocable = accepted && (mine || canResolve);

  return (
    <li
      className="border border-ink p-4"
      // hover (mouse) e focus (tastiera, via bottoni interni) evidenziano l'ancora
      onMouseEnter={() => onHover(comment.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(comment.id)}
      onBlur={() => onHover(null)}
    >
      <p className="flex flex-wrap items-center gap-1.5 font-mono text-sm text-foreground/50">
        {personLabel(comment.author)} ·{" "}
        {formatDateTime(comment.created_at)}
        {comment.promotion_status !== "none" && (
          <span className={`${tagClass} ${accepted ? "border-paprika text-paprika" : "border-ink text-foreground/70"}`}>
            {PROMOTION_BADGES[comment.promotion_status]}
          </span>
        )}
      </p>
      {comment.anchor_text && (
        <blockquote className="mt-1 border-l-2 border-dust pl-2 text-sm text-foreground/60">
          <span className="line-clamp-3 whitespace-pre-wrap">
            {comment.anchor_text}
          </span>
          {!comment.anchor_resolved && (
            <span className="mt-0.5 block italic text-foreground/40">
              {STRINGS.comments.staleAnchor}
            </span>
          )}
        </blockquote>
      )}
      {editing ? (
        <CommentEditForm comment={comment} onDone={() => setEditing(false)} />
      ) : (
        <>
          <p className="mt-1.5 whitespace-pre-wrap text-base">{comment.body}</p>
          {(mine || canDelete || promotable || resolvable || revocable) && (
            <div className="mt-3 flex flex-wrap gap-3 font-mono text-sm text-foreground/60">
              {mine && (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className={linkClass}
                >
                  {STRINGS.common.edit}
                </button>
              )}
              {/* un contributo accepted non si elimina: prima la revoca */}
              {canDelete &&
                !accepted &&
                (confirmingDelete ? (
                  <>
                    <DeleteCommentButton commentId={comment.id} />
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className={linkClass}
                    >
                      {STRINGS.common.cancel}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(true)}
                    className={dangerLinkClass}
                  >
                    {STRINGS.common.delete}
                  </button>
                ))}
              {promotable && (
                <PromotionButton
                  label={STRINGS.comments.propose}
                  action={() => requestCommentPromotion(comment.id)}
                />
              )}
              {resolvable && (
                <>
                  <PromotionButton
                    label={STRINGS.comments.accept}
                    action={() => resolveCommentPromotion(comment.id, true)}
                  />
                  <PromotionButton
                    label={STRINGS.comments.reject}
                    action={() => resolveCommentPromotion(comment.id, false)}
                  />
                </>
              )}
              {revocable && (
                <PromotionButton
                  label={STRINGS.comments.revoke}
                  action={() => revokeCommentPromotion(comment.id)}
                />
              )}
            </div>
          )}
        </>
      )}
    </li>
  );
}

// Bottone-form per le transizioni di promozione: stessa meccanica di
// DeleteCommentButton (useActionState + errore inline).
function PromotionButton({
  label,
  action,
}: {
  label: string;
  action: () => Promise<{ error: string } | null>;
}) {
  const [state, formAction, pending] = useActionState(async () => action(), null);

  return (
    <form action={formAction} className="inline">
      <button
        type="submit"
        disabled={pending}
        className={linkClass}
      >
        {label}
      </button>
      {state?.error && (
        <span role="alert" className="ml-2 text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}

function CommentEditForm({
  comment,
  onDone,
}: {
  comment: ProposalComment;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await editComment(comment.id, prev, formData);
      if (!result) onDone();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="mt-1 flex flex-col gap-2">
      <Field
        label={STRINGS.comments.editLabel}
        name="body"
        multiline
        required
        defaultValue={comment.body}
      />
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div className="flex gap-2">
        <SubmitButton pending={pending}>{STRINGS.common.save}</SubmitButton>
        <button type="button" onClick={onDone} className={buttonClass}>
          {STRINGS.common.cancel}
        </button>
      </div>
    </form>
  );
}

function DeleteCommentButton({ commentId }: { commentId: string }) {
  const [state, action, pending] = useActionState(
    async () => deleteComment(commentId),
    null,
  );

  return (
    <form action={action} className="inline">
      <button
        type="submit"
        disabled={pending}
        className={dangerLinkClass}
      >
        {STRINGS.comments.confirmDelete}
      </button>
      {state?.error && (
        <span role="alert" className="ml-2 text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
