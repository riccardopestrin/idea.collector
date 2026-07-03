"use client";

import { useActionState } from "react";

import { addComment } from "@/app/proposals/actions";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import type { AnchorField } from "@/lib/anchors";

export type PendingAnchor = {
  field: AnchorField;
  quote: string;
  occurrence: number;
};

// Form commenti del pannello dettaglio. Uncontrolled: React resetta il form al
// completamento dell'action; refresh() nel server aggiorna la lista.
// pendingAnchor (RFC-004 Fase D) mette il form in modalità ancorata: citazione
// sopra la textarea + hidden input per i campi anchor.
export function CommentForm({
  proposalId,
  pendingAnchor = null,
  onCancelAnchor,
}: {
  proposalId: string;
  pendingAnchor?: PendingAnchor | null;
  onCancelAnchor?: () => void;
}) {
  const [state, action, pending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await addComment(proposalId, prev, formData);
      if (!result) onCancelAnchor?.();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      {pendingAnchor && (
        <div className="flex flex-col gap-1 rounded-md border border-border bg-foreground/5 p-2">
          <blockquote className="line-clamp-3 whitespace-pre-wrap border-l-2 border-foreground/30 pl-2 text-xs text-foreground/60">
            {pendingAnchor.quote}
          </blockquote>
          <button
            type="button"
            onClick={onCancelAnchor}
            className="self-start text-xs text-foreground/50 underline underline-offset-2"
          >
            Annulla
          </button>
          <input type="hidden" name="anchor_field" value={pendingAnchor.field} />
          <input type="hidden" name="anchor_text" value={pendingAnchor.quote} />
          <input type="hidden" name="anchor_occurrence" value={pendingAnchor.occurrence} />
        </div>
      )}
      <Field
        label={pendingAnchor ? "Commenta la selezione" : "Aggiungi un commento"}
        name="body"
        multiline
        required
      />
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>Commenta</SubmitButton>
      </div>
    </form>
  );
}
