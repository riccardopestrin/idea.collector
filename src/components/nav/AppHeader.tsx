import Link from "next/link";
import { redirect } from "next/navigation";

import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";

const linkClass = "text-foreground/70 underline-offset-2 hover:underline";

// Header condiviso da board e classifica: brand, nav Board/Classifica, profilo, logout.
export function AppHeader({ profileLabel }: { profileLabel: string | null | undefined }) {
  async function logout() {
    "use server";
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-4 text-sm">
      <div className="flex items-center gap-4">
        <span className="font-semibold">{STRINGS.app.title}</span>
        <Link href="/" className={linkClass}>
          {STRINGS.nav.board}
        </Link>
        <Link href="/ranking" className={linkClass}>
          {STRINGS.nav.ranking}
        </Link>
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
