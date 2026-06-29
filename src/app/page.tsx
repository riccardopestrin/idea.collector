import Link from "next/link";
import { redirect } from "next/navigation";

import { supabaseServer } from "@/lib/supabase/server";

// Home autenticata. Il proxy già blocca i non loggati; ricontrolliamo qui vicino
// ai dati (pattern raccomandato) e per restringere il tipo di user. La dashboard
// vera e propria arriva negli step successivi.
export default async function Home() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // proposer è un embed to-one: PostgREST lo restituisce come oggetto singolo,
  // ma supabase-js senza tipi generati lo inferisce come array — corretto qui.
  const { data: proposals } = await supabase
    .from("proposals")
    .select("id, title, description, status, created_at, proposer:profiles(name, email)")
    .order("created_at", { ascending: false })
    .overrideTypes<
      Array<{
        id: string;
        title: string;
        description: string | null;
        status: string;
        created_at: string;
        proposer: { name: string | null; email: string } | null;
      }>,
      { merge: false }
    >();

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

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">Proposte</h1>
          <Link
            href="/proposals/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
          >
            Nuova proposta
          </Link>
        </div>

        {proposals && proposals.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {proposals.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-1 rounded-lg border border-border p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{p.title}</span>
                  <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-foreground/70">
                    {p.status}
                  </span>
                </div>
                {p.description && (
                  <p className="line-clamp-2 text-sm text-foreground/70">
                    {p.description}
                  </p>
                )}
                <span className="text-xs text-foreground/50">
                  di {p.proposer?.name ?? p.proposer?.email ?? "sconosciuto"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-foreground/70">
            Nessuna proposta ancora. Crea la prima.
          </p>
        )}
      </main>
    </>
  );
}
