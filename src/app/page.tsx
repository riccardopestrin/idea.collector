import Link from "next/link";
import { redirect } from "next/navigation";

import { Board } from "@/components/board/Board";
import { ProposalFilters } from "@/components/filters/ProposalFilters";
import { getProfile } from "@/lib/profiles";
import { isProposalStatus, listProposals } from "@/lib/proposals";
import { supabaseServer } from "@/lib/supabase/server";

// Home autenticata. Il proxy già blocca i non loggati; ricontrolliamo qui vicino
// ai dati (pattern raccomandato) e per restringere il tipo di user.
export default async function MainBoard({
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

  async function logout() {
    "use server";
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <>
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-semibold">Proposte feature</span>
        <div className="flex items-center gap-4 text-sm">
          <Link href="/profile" className="text-foreground/70 underline-offset-2 hover:underline">
            {profile?.name ?? user.email}
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="rounded-md border border-border px-3 py-1.5"
            >
              Esci
            </button>
          </form>
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Proposte</h1>
          {/* <a> e non <Link>: la nav soft verrebbe intercettata da
              @modal/(.)proposals/[id] (id="new") → notFound. Hard nav = niente interception. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- hard nav intenzionale, vedi sopra */}
          <a
            href="/proposals/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
          >
            Nuova proposta
          </a>
        </div>

        <ProposalFilters search={search} status={statusFilter} />

        {proposals.length === 0 && (
          <p className="text-sm text-foreground/70">
            {search || statusFilter
              ? "Nessuna proposta corrisponde ai filtri."
              : "Nessuna proposta ancora. Crea la prima."}
          </p>
        )}
        <Board proposals={proposals} userId={user.id} isAdmin={profile?.role === "admin"} />
      </main>
    </>
  );
}
