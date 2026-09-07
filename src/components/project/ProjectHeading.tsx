import Link from "next/link";
import type { ReactNode } from "react";

import { SettingsIcon } from "@/components/icons";
import { STRINGS } from "@/lib/strings";
import { pageTitleClass } from "@/lib/tokens";

// Titolo di una pagina di progetto: il NOME del progetto (fisso su board e
// classifica, non "Board"/"Classifica") con la rotella impostazioni di fianco
// (solo admin), e un'eventuale azione a destra (es. "Nuova proposta"). La
// rotella è UI-hiding: l'autorizzazione vera resta nella pagina impostazioni,
// nelle Server Action e nelle RLS.
export function ProjectHeading({
  project,
  action,
}: {
  project: { id: string; name: string; isAdmin: boolean };
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        <h1 className={pageTitleClass}>{project.name}</h1>
        {project.isAdmin && (
          <Link
            href={`/projects/${project.id}/settings`}
            aria-label={STRINGS.nav.settings}
            title={STRINGS.nav.settings}
            className="shrink-0 border border-ink p-1.5 hover:bg-ink hover:text-paper"
          >
            <SettingsIcon className="size-5" />
          </Link>
        )}
      </div>
      {action}
    </div>
  );
}
