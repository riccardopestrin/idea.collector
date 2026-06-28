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

  async function logout() {
    "use server";
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
      <p className="text-sm">
        Connesso come <strong>{user.email}</strong>
      </p>
      <Link
        href="/proposals/new"
        className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
      >
        Nuova proposta
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="rounded-md border border-border px-4 py-2 text-sm"
        >
          Esci
        </button>
      </form>
    </main>
  );
}
