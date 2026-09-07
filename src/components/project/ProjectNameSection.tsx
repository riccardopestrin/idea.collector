"use client";

import { useActionState } from "react";

import { renameProject } from "@/app/projects/actions";
import { Field } from "@/components/form/Field";
import { SettingsHeading } from "@/components/form/SettingsHeading";
import { SubmitButton } from "@/components/form/SubmitButton";
import { STRINGS } from "@/lib/strings";
import { settingsSectionClass } from "@/lib/tokens";

// Sezione "Nome del progetto" delle impostazioni, solo admin: rinomina la
// bacheca. Il campo è precompilato col nome corrente.
export function ProjectNameSection({ projectId, name }: { projectId: string; name: string }) {
  const [state, action, pending] = useActionState(renameProject.bind(null, projectId), null);

  return (
    <section className={settingsSectionClass}>
      <SettingsHeading heading={STRINGS.projects.rename.heading} intro={STRINGS.projects.rename.intro} />
      <form action={action} className="flex flex-col gap-3">
        <Field label={STRINGS.projects.nameLabel} name="name" required defaultValue={name} />
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <SubmitButton pending={pending}>{STRINGS.common.save}</SubmitButton>
      </form>
    </section>
  );
}
