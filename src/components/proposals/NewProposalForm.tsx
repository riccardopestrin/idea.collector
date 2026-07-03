"use client";

import { useActionState } from "react";

import { createProposal } from "@/app/proposals/new/actions";
import { RichTextField } from "@/components/editor/RichTextField";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";

// Form di creazione proposta, condiviso tra la pagina piena (/proposals/new)
// e l'overlay (@modal/(.)proposals/new).
export function NewProposalForm() {
  const [state, action, pending] = useActionState(createProposal, null);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <h1 className="text-xl font-semibold">Nuova proposta</h1>
      <Field label="Titolo" name="title" required />
      <RichTextField label="Descrizione" name="description" />
      <RichTextField label="Problema / motivazione" name="problem" />
      <Field label="Link (uno per riga)" name="links" multiline />
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>Crea proposta</SubmitButton>
      </div>
    </form>
  );
}
