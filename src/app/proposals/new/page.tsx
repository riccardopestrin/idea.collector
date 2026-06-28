"use client";

import { useActionState } from "react";

import { Field } from "@/components/Field";
import { SubmitButton } from "@/components/SubmitButton";

import { createProposal } from "./actions";

export default function NewProposalPage() {
  const [state, action, pending] = useActionState(createProposal, null);

  return (
    <main className="flex flex-1 justify-center p-6">
      <form action={action} className="flex w-full max-w-lg flex-col gap-4">
        <h1 className="text-xl font-semibold">Nuova proposta</h1>

        <Field label="Titolo" name="title" required />
        <Field label="Descrizione" name="description" multiline />
        <Field label="Problema / motivazione" name="problem" multiline />
        <Field label="Link (uno per riga)" name="links" multiline />

        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}

        <SubmitButton pending={pending}>Crea proposta</SubmitButton>
      </form>
    </main>
  );
}
