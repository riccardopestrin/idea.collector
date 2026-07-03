"use client";

import { SectionTitle } from "@/components/detail/SectionTitle";
import type { ProposalComment } from "@/lib/proposals";
import { personLabel } from "@/lib/proposals";

import { CommentForm, type PendingAnchor } from "./CommentForm";

const dateFormat = new Intl.DateTimeFormat("it-IT", {
  dateStyle: "medium",
  timeStyle: "short",
});

// Colonna commenti (RFC-004 Fase C/D): lista + form, con supporto alla
// modalità ancorata (citazione sopra la textarea). Un'ancora che non risolve
// più nel testo corrente mostra il badge "testo modificato".
export function CommentsSidebar({
  proposalId,
  comments,
  canComment,
  pendingAnchor,
  onCancelAnchor,
}: {
  proposalId: string;
  comments: ProposalComment[];
  canComment: boolean;
  pendingAnchor: PendingAnchor | null;
  onCancelAnchor: () => void;
}) {
  return (
    <aside className="flex flex-col gap-3 lg:border-l lg:border-border lg:pl-5">
      <SectionTitle>Commenti e osservazioni</SectionTitle>
      {comments.length === 0 ? (
        <p className="text-sm text-foreground/60">Nessun commento ancora.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-lg border border-border p-3">
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
              <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
            </li>
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
