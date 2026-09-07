import Link from "next/link";

import type { ProjectListItem } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";

// Card di un progetto nella lista in home: nome (link alla board), repo
// collegata, numero di proposte e ruolo di chi guarda.
export function ProjectCard({ project }: { project: ProjectListItem }) {
  const repo =
    project.github_owner && project.github_repo
      ? `${project.github_owner}/${project.github_repo}`
      : null;
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex flex-col gap-2 rounded-lg border border-border bg-background p-4 hover:border-foreground/40"
    >
      <span className="text-lg font-semibold">{project.name}</span>
      <span className="text-sm text-foreground/60">{repo ?? STRINGS.projects.noRepo}</span>
      <span className="flex items-center gap-2 text-xs text-foreground/50">
        {STRINGS.projects.proposalCount(project.proposalCount)}
        <span className="rounded-full border border-border px-2 py-0.5 font-medium text-foreground/70">
          {STRINGS.members.role[project.role]}
        </span>
      </span>
    </Link>
  );
}
