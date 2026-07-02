import Link from "next/link";
import { redirect } from "next/navigation";

import { Board } from "@/components/board/Board";
import { ProposalFilters } from "@/components/filters/ProposalFilters";
import { getRole } from "@/lib/profiles";
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

  const [proposals, role] = await Promise.all([
    listProposals(supabase, { search, status: statusFilter }),
    getRole(supabase, user.id),
  ]);

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
          <span className="text-foreground/70">{user.email}</span>
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
          <Link
            href="/proposals/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
          >
            Nuova proposta
          </Link>
        </div>

        <ProposalFilters search={search} status={statusFilter} />

        {proposals.length === 0 && (
          <p className="text-sm text-foreground/70">
            {search || statusFilter
              ? "Nessuna proposta corrisponde ai filtri."
              : "Nessuna proposta ancora. Crea la prima."}
          </p>
        )}
        <Board proposals={proposals} userId={user.id} isAdmin={role === "admin"} />
      </main>
    </>
  );
}
