import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { installationToken, listInstallationRepos } from "@/lib/github/app";
import { updateGithubSettings } from "@/lib/github/settings";
import { isProjectAdmin } from "@/lib/projects";
import { supabaseServer } from "@/lib/supabase/server";

// Callback dell'autorizzazione GitHub App (RFC-003): GitHub redirige qui con
// ?installation_id=… dopo che l'admin ha autorizzato l'App sulla repo scelta.
// Transport: autentica, autorizza admin del progetto, salva, mappa in redirect.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", url.origin));

  // Anti-CSRF: lo state deve combaciare col nonce messo in cookie da
  // startGithubConnect (insieme all'id del progetto) — solo un flusso avviato
  // da QUESTO admin, per QUEL progetto, arriva qui.
  const store = await cookies();
  const [expectedState, projectId] = store.get("github_connect_state")?.value.split(".") ?? [];
  store.delete("github_connect_state");
  if (!expectedState || !projectId || url.searchParams.get("state") !== expectedState) {
    return NextResponse.redirect(new URL("/", url.origin));
  }
  if (!(await isProjectAdmin(supabase, projectId, user.id))) {
    return NextResponse.redirect(new URL(`/projects/${projectId}`, url.origin));
  }

  const settingsUrl = `/projects/${projectId}/settings`;
  const installationId = Number(url.searchParams.get("installation_id"));
  if (!Number.isInteger(installationId) || installationId <= 0) {
    return NextResponse.redirect(new URL(`${settingsUrl}?github=error`, url.origin));
  }

  try {
    // installation_id è input esterno non firmato: verificato generando un
    // token con la NOSTRA private key — funziona solo se è un'installazione
    // della nostra App. Se copre una sola repo, la selezioniamo subito.
    await installationToken(installationId);
    const repos = await listInstallationRepos(installationId);
    const only = repos.length === 1 ? repos[0] : null;
    const result = await updateGithubSettings(projectId, {
      github_installation_id: installationId,
      github_owner: only?.owner ?? null,
      github_repo: only?.name ?? null,
    });
    if (result) throw new Error(result.error);
  } catch (err) {
    console.error("github callback:", err);
    return NextResponse.redirect(new URL(`${settingsUrl}?github=error`, url.origin));
  }

  return NextResponse.redirect(new URL(settingsUrl, url.origin));
}
