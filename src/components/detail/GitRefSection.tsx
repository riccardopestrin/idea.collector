"use client";

import { useActionState, useState } from "react";

import { setGitRef } from "@/app/proposals/[id]/actions";
import { SectionTitle } from "@/components/detail/SectionTitle";
import { buttonClass, controlClass, labelClass, linkClass } from "@/lib/tokens";
import { SubmitButton } from "@/components/form/SubmitButton";
import { gitRefUrl } from "@/lib/github/gitRef";
import { STRINGS } from "@/lib/strings";

// Branch/PR su cui si lavora (migration 0020). Link alla repo collegata se
// c'è; senza repo il riferimento resta testo. Edit inline per proposer/admin.
export function GitRefSection({
  proposalId,
  gitRef,
  repo,
  canEdit,
}: {
  proposalId: string;
  gitRef: string | null;
  repo: { owner: string; name: string } | null;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [state, action, pending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await setGitRef(proposalId, prev, formData);
      if (!result) setEditing(false);
      return result;
    },
    null,
  );

  return (
    <section className="flex flex-col gap-1">
      <div className="flex items-center gap-3">
        <SectionTitle>{STRINGS.proposal.gitRefHeading}</SectionTitle>
        {canEdit && !editing && (
          <button
            type="button"
            aria-label={STRINGS.proposal.gitRefEdit}
            onClick={() => setEditing(true)}
            className={`font-mono text-xs text-foreground/50 ${linkClass}`}
          >
            {STRINGS.common.edit}
          </button>
        )}
      </div>
      {editing ? (
        <form action={action} className="flex flex-col gap-2 text-sm">
          <label className="flex flex-col gap-1.5" htmlFor="git_ref">
            <span className={labelClass}>{STRINGS.proposal.gitRefLabel}</span>
            <input
              id="git_ref"
              name="git_ref"
              type="text"
              defaultValue={gitRef ?? ""}
              placeholder={STRINGS.proposal.gitRefPlaceholder}
              className={`${controlClass} font-mono`}
            />
          </label>
          <p className="text-xs text-foreground/50">{STRINGS.proposal.gitRefHint}</p>
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
      ) : gitRef ? (
        <p className="text-sm">
          {repo ? (
            <a
              href={gitRefUrl(gitRef, repo)}
              target="_blank"
              rel="noopener noreferrer"
              className={`break-all font-mono ${linkClass}`}
            >
              {gitRef}
            </a>
          ) : (
            <span className="break-all font-mono text-foreground/80">{gitRef}</span>
          )}
        </p>
      ) : (
        <p className="font-mono text-sm text-foreground/50">—</p>
      )}
    </section>
  );
}
