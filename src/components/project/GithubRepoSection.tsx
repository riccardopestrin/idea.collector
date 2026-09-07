"use client";

import { useActionState } from "react";

import { disconnectGithub, selectRepo, startGithubConnect } from "@/app/projects/actions";
import { buttonClass, controlClass, labelClass, settingsSectionClass } from "@/lib/tokens";
import { SettingsHeading } from "@/components/form/SettingsHeading";
import { SubmitButton } from "@/components/form/SubmitButton";
import type { InstallationRepo } from "@/lib/github/app";
import { STRINGS } from "@/lib/strings";

// Sezione "Repository progetto" (RFC-003) delle impostazioni, solo admin:
// connetti l'App GitHub, scegli la repo tra quelle autorizzate, scollega. Lato
// server la lista repo è già stata letta; qui solo form + stato errore.
export function GithubRepoSection({
  projectId,
  connected,
  selectedRepo,
  repos,
  loadError,
}: {
  projectId: string;
  connected: boolean;
  selectedRepo: string | null;
  repos: InstallationRepo[];
  loadError?: string;
}) {
  const [selectState, selectAction, selectPending] = useActionState(
    selectRepo.bind(null, projectId),
    null,
  );
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    async () => disconnectGithub(projectId),
    null,
  );
  const [connectState, connectAction, connectPending] = useActionState(
    async () => startGithubConnect(projectId),
    null,
  );

  const error =
    selectState?.error ?? disconnectState?.error ?? connectState?.error ?? loadError;

  return (
    <section className={settingsSectionClass}>
      <SettingsHeading heading={STRINGS.github.heading} intro={STRINGS.github.intro} />

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!connected ? (
        // Server Action (non link diretto): mette il nonce anti-CSRF in cookie
        // e redirige all'install URL con ?state (verificato dal callback).
        <form action={connectAction}>
          <SubmitButton pending={connectPending}>{STRINGS.github.connect}</SubmitButton>
        </form>
      ) : (
        <>
          {repos.length > 0 && (
            <form action={selectAction} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5" htmlFor="repo">
                <span className={labelClass}>{STRINGS.github.repoSelectLabel}</span>
                <select
                  id="repo"
                  name="repo"
                  defaultValue={selectedRepo ?? ""}
                  className={`${controlClass} font-mono`}
                >
                  {!selectedRepo && <option value="">{STRINGS.github.repoPlaceholder}</option>}
                  {repos.map((r) => (
                    <option key={`${r.owner}/${r.name}`} value={`${r.owner}/${r.name}`}>
                      {r.owner}/{r.name}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton pending={selectPending}>{STRINGS.github.saveRepo}</SubmitButton>
            </form>
          )}
          {selectedRepo && (
            <p className="text-sm text-foreground/80">
              {STRINGS.github.connectedRepoPrefix}
              <span className="font-mono font-medium">{selectedRepo}</span>
            </p>
          )}
          <form action={disconnectAction}>
            <button
              type="submit"
              disabled={disconnectPending}
              className={buttonClass}
            >
              {STRINGS.github.disconnect}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
