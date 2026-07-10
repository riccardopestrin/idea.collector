import { redirect } from "next/navigation";

import { ProposalCard } from "@/components/cards/ProposalCard";
import { ProposalFilters } from "@/components/filters/ProposalFilters";
import { AppHeader } from "@/components/nav/AppHeader";
import { getProfile } from "@/lib/profiles";
import { isProposalStatus, listProposals, rankProposalsByScore } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";

// Classifica: le proposte elencate per voto composito decrescente, a prescindere
// dallo stato (che resta visibile sulla card). Ricerca e filtro stato restano.
export default async function Ranking({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { q, status } = await searchParams;
  const search = (q ?? "").trim();
  const statusFilter = isProposalStatus(status) ? status : undefined;

  const [proposals, profile] = await Promise.all([
    listProposals(supabase, { search, status: statusFilter }),
    getProfile(supabase, user.id),
  ]);
  if (profile && !profile.name) redirect("/onboarding");

  const ranked = rankProposalsByScore(proposals);

  return (
    <>
      <AppHeader profileLabel={profile?.name ?? user.email} />

      <main className="flex w-full flex-1 flex-col gap-6 p-6">
        <h1 className="text-xl font-semibold">{STRINGS.nav.ranking}</h1>

        <ProposalFilters search={search} status={statusFilter} resetHref="/ranking" />

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
    </>
  );
}
