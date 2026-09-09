import { ProposalCard } from "@/components/cards/ProposalCard";
import { ProposalFilters } from "@/components/filters/ProposalFilters";
import { ProjectHeading } from "@/components/project/ProjectHeading";
import { isProposalStatus, listProposals, rankProposalsByScore } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";
import { displayClass, scrollRegionClass } from "@/lib/tokens";

import { loadProject } from "../project";

// Classifica del progetto: le proposte elencate per voto composito decrescente,
// a prescindere dallo stato (che resta visibile sulla card). Ricerca e filtro stati
// (più d'uno in OR, `status=a,b` nell'URL) restano.
export default async function Ranking({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const [{ projectId }, { q, status }] = await Promise.all([params, searchParams]);
  const search = (q ?? "").trim();
  // String(): con la chiave ripetuta (?status=a&status=b) Next passa un array
  const statuses = String(status ?? "").split(",").filter(isProposalStatus);

  // Come in board: la query parte in parallelo a loadProject.
  const [{ project, role }, proposals] = await Promise.all([
    loadProject(projectId),
    supabaseServer().then((s) => listProposals(s, { projectId, search, statuses })),
  ]);
  const ranked = rankProposalsByScore(proposals);

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col gap-6 p-6">
      <ProjectHeading project={{ id: project.id, name: project.name, isAdmin: role === "admin" }} />

      <ProposalFilters
        search={search}
        statuses={statuses}
        basePath={`/projects/${project.id}/ranking`}
      />

      {ranked.length === 0 ? (
        <p className="font-mono text-sm text-foreground/70">
          {search || statuses.length > 0 ? STRINGS.board.noneMatchFilters : STRINGS.board.noneYet}
        </p>
      ) : (
        <div className={`${scrollRegionClass} border-t border-ink pt-6`}>
          <ol className="flex max-w-4xl flex-col gap-3">
            {ranked.map((proposal, i) => (
              <li key={proposal.id} className="flex items-stretch gap-3">
                <span className={`flex w-12 shrink-0 items-center justify-center border border-ink ${displayClass} text-xl`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex-1">
                  <ProposalCard proposal={proposal} showStatus />
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </main>
  );
}
