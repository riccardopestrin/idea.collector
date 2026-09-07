import Link from "next/link";

import type { ProjectListItem } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";
import { displayClass, labelClass, liftClass, tagClass } from "@/lib/tokens";

// Card di un progetto nella lista in home: numero d'ordine, nome (link alla
// board), repo collegata, numero di proposte e ruolo di chi guarda.
export function ProjectCard({ project, index }: { project: ProjectListItem; index: number }) {
  const repo =
    project.github_owner && project.github_repo
      ? `${project.github_owner}/${project.github_repo}`
      : null;
  return (
    <Link
      href={`/projects/${project.id}`}
      className={`flex h-full flex-col gap-6 border border-ink bg-paper p-5 ${liftClass}`}
    >
      <span className="flex items-center justify-between font-mono text-xs text-foreground/60">
        <span>{String(index + 1).padStart(2, "0")}</span>
        <span className={`${tagClass} border-ink`}>{STRINGS.members.role[project.role]}</span>
      </span>
      <span className={`${displayClass} text-2xl tracking-tight`}>{project.name}</span>
      <span className="mt-auto flex flex-col gap-1 text-foreground/60">
        <span className="truncate font-mono text-xs">{repo ?? STRINGS.projects.noRepo}</span>
        <span className={labelClass}>{STRINGS.projects.proposalCount(project.proposalCount)}</span>
      </span>
    </Link>
  );
}
