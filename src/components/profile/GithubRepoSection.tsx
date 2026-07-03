"use client";

import { useActionState } from "react";

import { disconnectGithub, selectRepo, startGithubConnect } from "@/app/profile/actions";
import { controlClass } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import type { InstallationRepo } from "@/lib/github/app";

// Sezione "Repository progetto" (RFC-003), solo admin: connetti l'App GitHub,
// scegli la repo tra quelle autorizzate, scollega. Lato server la lista repo è
// già stata letta; qui solo form + stato errore.
export function GithubRepoSection({
  connected,
  selectedRepo,
  repos,
  loadError,
}: {
  connected: boolean;
  selectedRepo: string | null;
  repos: InstallationRepo[];
  loadError?: string;
}) {
  const [selectState, selectAction, selectPending] = useActionState(selectRepo, null);
  const [disconnectState, disconnectAction, disconnectPending] = useActionState(
    async () => disconnectGithub(),
    null,
  );
  const [connectState, connectAction, connectPending] = useActionState(
    async () => startGithubConnect(),
    null,
  );

  const error =
    selectState?.error ?? disconnectState?.error ?? connectState?.error ?? loadError;

  return (
    <section className="flex w-full max-w-lg flex-col gap-3 border-t border-border pt-6">
      <h2 className="text-lg font-semibold">Repository progetto</h2>
      <p className="text-sm text-foreground/60">
        La valutazione AI confronta le proposte con il contesto di questo repository
        (accesso in sola lettura via GitHub App).
      </p>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      {!connected ? (
        // Server Action (non link diretto): mette il nonce anti-CSRF in cookie
        // e redirige all'install URL con ?state (verificato dal callback).
        <form action={connectAction}>
          <SubmitButton pending={connectPending}>Connetti GitHub</SubmitButton>
        </form>
      ) : (
        <>
          {repos.length > 0 && (
            <form action={selectAction} className="flex flex-col gap-3">
              <label className="flex flex-col gap-1 text-sm" htmlFor="repo">
                Repo del progetto
                <select
                  id="repo"
                  name="repo"
                  defaultValue={selectedRepo ?? ""}
                  className={controlClass}
                >
                  {!selectedRepo && <option value="">— scegli una repo —</option>}
                  {repos.map((r) => (
                    <option key={`${r.owner}/${r.name}`} value={`${r.owner}/${r.name}`}>
                      {r.owner}/{r.name}
                    </option>
                  ))}
                </select>
              </label>
              <SubmitButton pending={selectPending}>Salva repo</SubmitButton>
            </form>
          )}
          {selectedRepo && (
            <p className="text-sm text-foreground/80">
              Repo collegata: <span className="font-medium">{selectedRepo}</span>
            </p>
          )}
          <form action={disconnectAction}>
            <button
              type="submit"
              disabled={disconnectPending}
              className={`${controlClass} text-sm disabled:opacity-50`}
            >
              Scollega GitHub
            </button>
          </form>
        </>
      )}
    </section>
  );
}
