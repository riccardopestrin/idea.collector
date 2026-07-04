import Link from "next/link";
import { redirect } from "next/navigation";

import { Board } from "@/components/board/Board";
import { ProposalFilters } from "@/components/filters/ProposalFilters";
import { AppHeader } from "@/components/nav/AppHeader";
import { getProfile } from "@/lib/profiles";
import { listProposals } from "@/lib/proposals";
import { supabaseServer } from "@/lib/supabase/server";

// Home autenticata. Il proxy già blocca i non loggati; ricontrolliamo qui vicino
// ai dati (pattern raccomandato) e per restringere il tipo di user.
export default async function MainBoard({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { q } = await searchParams;
  const search = (q ?? "").trim();

  // Niente filtro stato in board: le colonne per stato sono già il filtro visivo.
  const [proposals, profile] = await Promise.all([
    listProposals(supabase, { search }),
    getProfile(supabase, user.id),
  ]);
  if (profile && !profile.name) redirect("/onboarding");

  return (
    <>
      <AppHeader profileLabel={profile?.name ?? user.email} />

      <main className="flex w-full flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Proposte</h1>
          <Link
            href="/proposals/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
          >
            Nuova proposta
          </Link>
        </div>

        <ProposalFilters search={search} showStatus={false} />

        {proposals.length === 0 && (
          <p className="text-sm text-foreground/70">
            {search
              ? "Nessuna proposta corrisponde ai filtri."
              : "Nessuna proposta ancora. Crea la prima."}
          </p>
        )}
        <Board proposals={proposals} userId={user.id} isAdmin={profile?.role === "admin"} />
      </main>
    </>
  );
}
