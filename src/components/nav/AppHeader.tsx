import Link from "next/link";
import { redirect } from "next/navigation";

import { CornerDownLeftIcon } from "@/components/icons";
import { NavLink } from "@/components/nav/NavLink";
import { Wordmark } from "@/components/nav/Wordmark";
import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";
import { buttonClass } from "@/lib/tokens";

type HeaderProject = { id: string; name: string; isAdmin: boolean };

// Header condiviso: brand (→ lista progetti), profilo, logout. Dentro un
// progetto aggiunge il nome e la nav Board/Classifica (+ Impostazioni per
// l'admin). UI-hiding: l'autorizzazione vera è nella pagina impostazioni,
// nelle Server Action e nelle RLS. Il link profilo apre l'overlay
// @modal/(.)profile: si resta sulla pagina corrente.
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
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-ink px-6 py-3">
      <div className="flex min-w-0 items-center gap-6">
        <Link href="/" className="shrink-0 hover:text-paprika">
          <Wordmark />
        </Link>
        {project && (
          <nav aria-label={project.name} className="flex min-w-0 items-center gap-5">
            <Link
              href="/"
              aria-label={STRINGS.nav.backToProjects}
              title={STRINGS.nav.backToProjects}
              className="-mr-3 border border-ink p-1 hover:bg-ink hover:text-paper"
            >
              <CornerDownLeftIcon className="size-3" />
            </Link>
            <span className="truncate font-mono text-sm font-medium">{project.name}</span>
            <NavLink href={`/projects/${project.id}`}>
              {STRINGS.nav.board}
            </NavLink>
            <NavLink href={`/projects/${project.id}/ranking`}>
              {STRINGS.nav.ranking}
            </NavLink>
            {project.isAdmin && (
              <NavLink href={`/projects/${project.id}/settings`}>
                {STRINGS.nav.settings}
              </NavLink>
            )}
          </nav>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <NavLink href="/profile">{profileLabel}</NavLink>
        <form action={logout}>
          <button type="submit" className={buttonClass}>
            {STRINGS.nav.logout}
          </button>
        </form>
      </div>
    </header>
  );
}
