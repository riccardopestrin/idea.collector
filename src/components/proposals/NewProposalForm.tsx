"use client";

import { useActionState } from "react";

import { createProposal } from "@/app/proposals/new/actions";
import { RichTextField } from "@/components/editor/RichTextField";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import { STRINGS } from "@/lib/strings";
import { displayClass } from "@/lib/tokens";

// Form di creazione proposta in un progetto, condiviso tra la pagina piena
// (/projects/[id]/proposals/new) e l'overlay (@modal/(.)projects/[id]/proposals/new).
export function NewProposalForm({ projectId }: { projectId: string }) {
  const [state, action, pending] = useActionState(createProposal.bind(null, projectId), null);

  return (
    <form action={action} className="flex w-full flex-col gap-5">
      <h1 className={`${displayClass} text-3xl`}>{STRINGS.board.newProposal}</h1>
      <Field label={STRINGS.proposal.titleLabel} name="title" required />
      {/* un solo body: la descrizione riempie l'altezza del modal (fill). Il campo
          "problema" è deprecato ovunque. */}
      <RichTextField label={STRINGS.proposal.descriptionLabel} name="description" fill />
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
