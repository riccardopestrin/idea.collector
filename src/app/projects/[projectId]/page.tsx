import Link from "next/link";

import { Board } from "@/components/board/Board";
import { ProposalFilters } from "@/components/filters/ProposalFilters";
import { PlusIcon } from "@/components/icons";
import { ProjectHeading } from "@/components/project/ProjectHeading";
import { listProposals } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";
import { primaryButtonClass } from "@/lib/tokens";

import { loadProject } from "./project";

// Board del progetto (ADR-0002): colonne per stato, ricerca, "Nuova proposta".
export default async function ProjectBoard({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const [{ projectId }, { q }] = await Promise.all([params, searchParams]);
  const search = (q ?? "").trim();

  // Niente filtro stato in board: le colonne per stato sono già il filtro visivo.
  // listProposals dipende solo dall'id: parte insieme a loadProject (un round
  // trip in meno); per un non membro la RLS dà [] e loadProject fa notFound.
  const [{ user, project, role }, proposals] = await Promise.all([
    loadProject(projectId),
    supabaseServer().then((s) => listProposals(s, { projectId, search })),
  ]);

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <ProjectHeading
        project={{ id: project.id, name: project.name, isAdmin: role === "admin" }}
        action={
          <Link
            href={`/projects/${project.id}/proposals/new`}
            className={`inline-flex items-center gap-2 ${primaryButtonClass}`}
          >
            <PlusIcon className="size-3.5" />
            {STRINGS.board.newProposal}
          </Link>
        }
      />

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
