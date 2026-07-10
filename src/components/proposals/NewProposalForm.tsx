"use client";

import { useActionState } from "react";

import { createProposal } from "@/app/proposals/new/actions";
import { RichTextField } from "@/components/editor/RichTextField";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import { STRINGS } from "@/lib/strings";

// Form di creazione proposta, condiviso tra la pagina piena (/proposals/new)
// e l'overlay (@modal/(.)proposals/new).
export function NewProposalForm() {
  const [state, action, pending] = useActionState(createProposal, null);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <h1 className="text-xl font-semibold">{STRINGS.board.newProposal}</h1>
      <Field label={STRINGS.proposal.titleLabel} name="title" required />
      <RichTextField label={STRINGS.proposal.descriptionLabel} name="description" />
      <RichTextField label={STRINGS.proposal.problemLabel} name="problem" />
      <Field label={STRINGS.proposal.linksLabel} name="links" multiline />
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>{STRINGS.proposal.create}</SubmitButton>
      </div>
    </form>
  );
}
