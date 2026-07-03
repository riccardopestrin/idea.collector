"use client";

import { useActionState, useState } from "react";

import { deleteComment, editComment } from "@/app/proposals/actions";
import { SectionTitle } from "@/components/detail/SectionTitle";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import type { ProposalComment } from "@/lib/proposals";
import { personLabel } from "@/lib/proposals";

import { CommentForm, type PendingAnchor } from "./CommentForm";

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
});

// Colonna commenti (RFC-004 Fase C/D): lista + form, con supporto alla
// modalità ancorata (citazione sopra la textarea). Un'ancora che non risolve
// più nel testo corrente mostra il badge "testo modificato". L'hover su un
// commento evidenzia il passaggio citato nel testo (onHoverComment).
export function CommentsSidebar({
  proposalId,
  comments,
  canComment,
  currentUserId,
  pendingAnchor,
  onCancelAnchor,
  onHoverComment,
}: {
  proposalId: string;
  comments: ProposalComment[];
  canComment: boolean;
  currentUserId?: string;
  pendingAnchor: PendingAnchor | null;
  onCancelAnchor: () => void;
  onHoverComment: (commentId: string | null) => void;
}) {
  return (
    <aside className="flex flex-col gap-3 lg:border-l lg:border-border lg:pl-5">
      <SectionTitle>Commenti e osservazioni</SectionTitle>
      {comments.length === 0 ? (
        <p className="text-sm text-foreground/60">Nessun commento ancora.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              // edit/delete solo al creatore e solo su proposta aperta (canComment)
              mine={canComment && comment.author_id === currentUserId}
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

function CommentItem({
  comment,
  mine,
  onHover,
}: {
  comment: ProposalComment;
  mine: boolean;
  onHover: (commentId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <li
      className="rounded-lg border border-border p-3"
      // hover (mouse) e focus (tastiera, via bottoni interni) evidenziano l'ancora
      onMouseEnter={() => onHover(comment.id)}
      onMouseLeave={() => onHover(null)}
      onFocus={() => onHover(comment.id)}
      onBlur={() => onHover(null)}
    >
      <p className="text-xs text-foreground/50">
        {personLabel(comment.author)} ·{" "}
        {dateFormat.format(new Date(comment.created_at))}
      </p>
      {comment.anchor_text && (
        <blockquote className="mt-1 border-l-2 border-foreground/30 pl-2 text-xs text-foreground/60">
          <span className="line-clamp-3 whitespace-pre-wrap">
            {comment.anchor_text}
          </span>
          {!comment.anchor_resolved && (
            <span className="mt-0.5 block italic text-foreground/40">
              testo modificato
            </span>
          )}
        </blockquote>
      )}
      {editing ? (
        <CommentEditForm comment={comment} onDone={() => setEditing(false)} />
      ) : (
        <>
          <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
          {mine && (
            <div className="mt-2 flex gap-3 text-xs text-foreground/50">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="underline underline-offset-2"
              >
                Modifica
              </button>
              {confirmingDelete ? (
                <>
                  <DeleteCommentButton commentId={comment.id} />
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    className="underline underline-offset-2"
                  >
                    Annulla
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(true)}
                  className="text-danger underline underline-offset-2"
                >
                  Elimina
                </button>
              )}
            </div>
          )}
        </>
      )}
    </li>
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
        label="Modifica commento"
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
        <SubmitButton pending={pending}>Salva</SubmitButton>
        <button
          type="button"
          onClick={onDone}
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Annulla
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
        className="text-danger underline underline-offset-2 disabled:opacity-50"
      >
        Conferma eliminazione
      </button>
      {state?.error && (
        <span role="alert" className="ml-2 text-danger">
          {state.error}
        </span>
      )}
    </form>
  );
}
