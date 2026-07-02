"use client";

import { useActionState } from "react";

import { addComment } from "@/app/proposals/actions";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";

// Form commenti del pannello dettaglio. Uncontrolled: React resetta il form al
// completamento dell'action; refresh() nel server aggiorna la lista.
export function CommentForm({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState(
    addComment.bind(null, proposalId),
    null,
  );

  return (
    <form action={action} className="flex flex-col gap-2">
      <Field label="Aggiungi un commento" name="body" multiline required />
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
