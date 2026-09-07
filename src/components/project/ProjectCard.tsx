import Link from "next/link";

import type { ProjectListItem } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";
import { displayClass, labelClass, liftClass, tagClass } from "@/lib/tokens";

// Card di un progetto nella lista in home: nome (link alla board), repo
// collegata, numero di proposte e ruolo di chi guarda. Presentazionale come
// ProposalCard: il nome è un Link con stopPropagation, il resto della card è la
// presa per il drag della <li> che la ospita (riordino manuale, #6). Niente
// numero d'ordine (l'ordine è manuale).
export function ProjectCard({ project }: { project: ProjectListItem }) {
  const repo =
    project.github_owner && project.github_repo
      ? `${project.github_owner}/${project.github_repo}`
      : null;
  return (
    <div className={`flex h-full flex-col gap-4 border border-ink bg-paper p-5 ${liftClass}`}>
      <span className="flex items-center justify-end font-mono text-xs text-foreground/60">
        <span className={`${tagClass} border-ink`}>{STRINGS.members.role[project.role]}</span>
      </span>
      <Link
        href={`/projects/${project.id}`}
        // il click non deve avviare il drag della <li> che ci ospita
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className={`${displayClass} text-3xl tracking-tight hover:text-paprika`}
      >
        {project.name}
      </Link>
      {/* niente mt-auto: il testo sta in alto vicino al titolo, non ancorato al fondo */}
      <span className="flex flex-col gap-1 text-foreground/60">
        <span className="truncate font-mono text-sm">{repo ?? STRINGS.projects.noRepo}</span>
        <span className={labelClass}>{STRINGS.projects.proposalCount(project.proposalCount)}</span>
      </span>
    </div>
  );
}
