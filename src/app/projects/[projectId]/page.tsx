import Link from "next/link";

import { Board } from "@/components/board/Board";
import { ProposalFilters } from "@/components/filters/ProposalFilters";
import { PlusIcon } from "@/components/icons";
import { listProposals } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";
import { pageTitleClass, primaryButtonClass } from "@/lib/tokens";

import { loadProject } from "./project";

// Board del progetto (ADR-0002): colonne per stato, ricerca, "Nuova proposta".
export default async function ProjectBoard({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { supabase, user, project, role } = await loadProject((await params).projectId);

  const { q } = await searchParams;
  const search = (q ?? "").trim();

  // Niente filtro stato in board: le colonne per stato sono già il filtro visivo.
  const proposals = await listProposals(supabase, { projectId: project.id, search });

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className={pageTitleClass}>{STRINGS.board.heading}</h1>
        <Link
          href={`/projects/${project.id}/proposals/new`}
          className={`inline-flex items-center gap-2 ${primaryButtonClass}`}
        >
          <PlusIcon className="size-3.5" />
          {STRINGS.board.newProposal}
        </Link>
      </div>

      <ProposalFilters search={search} showStatus={false} basePath={`/projects/${project.id}`} />

      {proposals.length === 0 && (
        <p className="font-mono text-sm text-foreground/70">
          {search ? STRINGS.board.noneMatchFilters : STRINGS.board.noneYetCreate}
        </p>
      )}
      <Board proposals={proposals} userId={user.id} isAdmin={role === "admin"} />
    </main>
  );
}
