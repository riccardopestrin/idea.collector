"use client";

import { useActionState } from "react";

import { createProject } from "@/app/projects/actions";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import { STRINGS } from "@/lib/strings";

// Form di creazione progetto: nome obbligatorio; la repo GitHub è opzionale e
// si collega dalle impostazioni (flusso GitHub App), qui solo la spunta che ci porta.
export function NewProjectForm() {
  const [state, action, pending] = useActionState(createProject, null);

  return (
    <form action={action} className="flex w-full flex-col gap-4">
      <h1 className="text-xl font-semibold">{STRINGS.projects.newProject}</h1>
      <Field label={STRINGS.projects.nameLabel} name="name" required />
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="connect_repo" />
        {STRINGS.projects.connectRepo}
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>{STRINGS.projects.create}</SubmitButton>
      </div>
    </form>
  );
}
