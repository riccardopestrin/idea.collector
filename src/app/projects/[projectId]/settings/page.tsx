import { redirect } from "next/navigation";

import { GithubRepoSection } from "@/components/project/GithubRepoSection";
import { MembersSection } from "@/components/project/MembersSection";
import { type InstallationRepo, listInstallationRepos } from "@/lib/github/app";
import { connectedRepo } from "@/lib/github/settings";
import { listMembers } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";
import { pageTitleClass } from "@/lib/tokens";

import { loadProject } from "../project";

// Impostazioni del progetto, solo admin: membri (inviti, ruoli, rimozione) e
// repository GitHub usato come contesto per la valutazione AI (RFC-003).
export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ github?: string }>;
}) {
  const { supabase, user, project, role } = await loadProject((await params).projectId);
  // UI-hiding non è autorizzazione: le action e le RLS rifiutano comunque
  if (role !== "admin") redirect(`/projects/${project.id}`);

  const members = await listMembers(supabase, project.id);

  const repo = connectedRepo(project);
  let repos: InstallationRepo[] = [];
  let loadError: string | undefined;
  if (project.github_installation_id) {
    try {
      repos = await listInstallationRepos(project.github_installation_id);
    } catch (err) {
      console.error("project settings github:", err);
      loadError = STRINGS.github.reposLoadFailed;
    }
  }
  const callbackFailed = (await searchParams).github === "error";

  return (
    <main className="flex flex-1 flex-col items-center gap-10 p-6">
      <div className="flex w-full max-w-lg flex-col gap-2">
        <h1 className={pageTitleClass}>
          {STRINGS.projects.settingsHeading}
        </h1>
        <p className="font-mono text-sm text-foreground/60">{project.name}</p>
      </div>
      <MembersSection projectId={project.id} members={members} currentUserId={user.id} />
      <GithubRepoSection
        projectId={project.id}
        connected={Boolean(project.github_installation_id)}
        selectedRepo={repo ? `${repo.owner}/${repo.name}` : null}
        repos={repos}
        loadError={loadError ?? (callbackFailed ? STRINGS.github.connectFailed : undefined)}
      />
    </main>
  );
}
