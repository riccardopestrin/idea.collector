"use client";

import { useActionState, useState } from "react";

import { SectionTitle } from "@/components/detail/SectionTitle";
import { SubmitButton } from "@/components/form/SubmitButton";
import { STRINGS } from "@/lib/strings";
import { buttonClass, controlClass, labelClass, linkClass } from "@/lib/tokens";

export type RefTexts = {
  heading: string;
  edit: string;
  label: string;
  placeholder: string;
  hint: string;
};

// Riferimento di lavoro sulla proposta (branch/PR, task ClickUp): valore in
// mono, link se href, edit inline per proposer/admin. La Server Action arriva
// già legata alla proposta (bind lato server).
export function RefSection({
  texts,
  name,
  value,
  href,
  canEdit,
  action,
}: {
  texts: RefTexts;
  name: string;
  value: string | null;
  href: string | null;
  canEdit: boolean;
  action: (prev: { error: string } | null, formData: FormData) => Promise<{ error: string } | null>;
}) {
  const [editing, setEditing] = useState(false);
  const [state, submit, pending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await action(prev, formData);
      if (!result) setEditing(false);
      return result;
    },
    null,
  );

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <SectionTitle>{texts.heading}</SectionTitle>
        {canEdit && !editing && (
          <button
            type="button"
            aria-label={texts.edit}
            onClick={() => setEditing(true)}
            className={`font-mono text-xs text-foreground/50 ${linkClass}`}
          >
            {STRINGS.common.edit}
          </button>
        )}
      </div>
      {editing ? (
        <form action={submit} className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1.5" htmlFor={name}>
            <span className={labelClass}>{texts.label}</span>
            <input
              id={name}
              name={name}
              type="text"
              defaultValue={value ?? ""}
              placeholder={texts.placeholder}
              className={`${controlClass} font-mono`}
            />
          </label>
          <p className="text-xs text-foreground/50">{texts.hint}</p>
          {state?.error && (
            <p role="alert" className="text-danger">
              {state.error}
            </p>
          )}
          <div className="flex gap-2">
            <SubmitButton pending={pending}>{STRINGS.common.save}</SubmitButton>
            <button type="button" onClick={() => setEditing(false)} className={buttonClass}>
              {STRINGS.common.cancel}
            </button>
          </div>
        </form>
      ) : value ? (
        <p className="text-sm">
          {href ? (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={`break-all font-mono ${linkClass}`}
            >
              {value}
            </a>
          ) : (
            <span className="break-all font-mono text-foreground/80">{value}</span>
          )}
        </p>
      ) : (
        <p className="font-mono text-sm text-foreground/50">—</p>
      )}
    </section>
  );
}
