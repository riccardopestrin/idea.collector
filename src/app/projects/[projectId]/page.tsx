import Link from "next/link";

import { Board } from "@/components/board/Board";
import { ProposalFilters } from "@/components/filters/ProposalFilters";
import { listProposals } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";

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
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{STRINGS.board.heading}</h1>
        <Link
          href={`/projects/${project.id}/proposals/new`}
          className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
        >
          {STRINGS.board.newProposal}
        </Link>
      </div>

      <ProposalFilters search={search} showStatus={false} resetHref={`/projects/${project.id}`} />

      {proposals.length === 0 && (
        <p className="text-sm text-foreground/70">
          {search ? STRINGS.board.noneMatchFilters : STRINGS.board.noneYetCreate}
        </p>
      )}
      <Board proposals={proposals} userId={user.id} isAdmin={role === "admin"} />
    </main>
  );
}
