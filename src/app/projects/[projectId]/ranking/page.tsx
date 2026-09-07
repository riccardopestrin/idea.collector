import { ProposalCard } from "@/components/cards/ProposalCard";
import { ProposalFilters } from "@/components/filters/ProposalFilters";
import { isProposalStatus, listProposals, rankProposalsByScore } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";

import { loadProject } from "../project";

// Classifica del progetto: le proposte elencate per voto composito decrescente,
// a prescindere dallo stato (che resta visibile sulla card). Ricerca e filtro stato restano.
export default async function Ranking({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const { supabase, project } = await loadProject((await params).projectId);

  const { q, status } = await searchParams;
  const search = (q ?? "").trim();
  const statusFilter = isProposalStatus(status) ? status : undefined;

  const proposals = await listProposals(supabase, {
    projectId: project.id,
    search,
    status: statusFilter,
  });
  const ranked = rankProposalsByScore(proposals);

  return (
    <main className="flex w-full flex-1 flex-col gap-6 p-6">
      <h1 className="text-xl font-semibold">{STRINGS.nav.ranking}</h1>

      <ProposalFilters
        search={search}
        status={statusFilter}
        resetHref={`/projects/${project.id}/ranking`}
      />

      {ranked.length === 0 ? (
        <p className="text-sm text-foreground/70">
          {search || statusFilter ? STRINGS.board.noneMatchFilters : STRINGS.board.noneYet}
        </p>
      ) : (
        <ol className="flex flex-col gap-3">
          {ranked.map((proposal, i) => (
            <li key={proposal.id} className="flex items-center gap-3">
              <span className="w-6 shrink-0 text-right text-sm font-medium text-foreground/50">
                {i + 1}
              </span>
              <div className="flex-1">
                <ProposalCard proposal={proposal} showStatus />
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
