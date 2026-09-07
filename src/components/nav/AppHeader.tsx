import Link from "next/link";
import { redirect } from "next/navigation";

import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";

const linkClass = "text-foreground/70 underline-offset-2 hover:underline";

type HeaderProject = { id: string; name: string; isAdmin: boolean };

// Header condiviso: brand (→ lista progetti), profilo, logout. Dentro un
// progetto aggiunge il ritorno alla lista, il nome e la nav Board/Classifica
// (+ Impostazioni per l'admin). UI-hiding: l'autorizzazione vera è nella
// pagina impostazioni, nelle Server Action e nelle RLS.
export function AppHeader({
  profileLabel,
  project,
}: {
  profileLabel: string | null | undefined;
  project?: HeaderProject;
}) {
  async function logout() {
    "use server";
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 text-sm">
      <div className="flex items-center gap-4">
        <Link href="/" className="font-semibold">
          {STRINGS.app.title}
        </Link>
        {project && (
          <>
            <Link href="/" className={linkClass}>
              {STRINGS.nav.backToProjects}
            </Link>
            <span className="font-medium">{project.name}</span>
            <Link href={`/projects/${project.id}`} className={linkClass}>
              {STRINGS.nav.board}
            </Link>
            <Link href={`/projects/${project.id}/ranking`} className={linkClass}>
              {STRINGS.nav.ranking}
            </Link>
            {project.isAdmin && (
              <Link href={`/projects/${project.id}/settings`} className={linkClass}>
                {STRINGS.nav.settings}
              </Link>
            )}
          </>
        )}
      </div>
      <div className="flex items-center gap-4">
        <Link href="/profile" className={linkClass}>
          {profileLabel}
        </Link>
        <form action={logout}>
          <button type="submit" className="rounded-md border border-border px-3 py-1.5">
            {STRINGS.nav.logout}
          </button>
        </form>
      </div>
    </header>
  );
}
