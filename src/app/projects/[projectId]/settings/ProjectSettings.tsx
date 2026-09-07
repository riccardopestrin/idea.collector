import { redirect } from "next/navigation";

import { DeleteSection } from "@/components/form/DeleteSection";
import { GithubRepoSection } from "@/components/project/GithubRepoSection";
import { MembersSection } from "@/components/project/MembersSection";
import { ProjectNameSection } from "@/components/project/ProjectNameSection";
import { type InstallationRepo, listInstallationRepos } from "@/lib/github/app";
import { connectedRepo } from "@/lib/github/settings";
import { listMembers } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";
import { pageTitleClass } from "@/lib/tokens";

import { deleteProject } from "../../actions";
import { loadProject } from "../project";

// Contenuto delle impostazioni progetto (solo admin): membri, repo GitHub, nome,
// eliminazione. Fa il proprio caricamento dati ed è condiviso tra la pagina piena
// (fallback hard-nav / callback GitHub) e l'overlay @modal. Il redirect non-admin
// è il guard reale (l'ingranaggio è nascosto ai non-admin, ma UI-hiding non basta).
export async function ProjectSettings({
  projectId,
  githubCallbackFailed = false,
}: {
  projectId: string;
  githubCallbackFailed?: boolean;
}) {
  const { supabase, user, project, role } = await loadProject(projectId);
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

  return (
    <div className="flex w-full flex-col items-center gap-10">
      <div className="flex w-full max-w-lg flex-col gap-2">
        <h1 className={pageTitleClass}>{STRINGS.projects.settingsHeading}</h1>
        <p className="font-mono text-sm text-foreground/60">{project.name}</p>
      </div>
      <ProjectNameSection projectId={project.id} name={project.name} />
      <MembersSection projectId={project.id} members={members} currentUserId={user.id} />
      <GithubRepoSection
        projectId={project.id}
        connected={Boolean(project.github_installation_id)}
        selectedRepo={repo ? `${repo.owner}/${repo.name}` : null}
        repos={repos}
        loadError={loadError ?? (githubCallbackFailed ? STRINGS.github.connectFailed : undefined)}
      />
      <DeleteSection
        texts={STRINGS.projects.delete}
        confirmHeading={STRINGS.projects.deleteConfirmHeading(project.name)}
        action={deleteProject.bind(null, project.id)}
      />
    </div>
  );
}
