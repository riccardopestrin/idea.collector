import Link from "next/link";
import { redirect } from "next/navigation";

import { PlusIcon } from "@/components/icons";
import { AppHeader } from "@/components/nav/AppHeader";
import { ProjectList } from "@/components/project/ProjectList";
import { getProfile } from "@/lib/profiles";
import { listProjects } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";
import { currentUser, supabaseServer } from "@/lib/supabase/server";
import { pageTitleClass, primaryButtonClass } from "@/lib/tokens";

// Home autenticata: la lista dei progetti (bacheche) di cui l'utente è membro,
// con il "+" per crearne uno. Il proxy già blocca i non loggati; ricontrolliamo
// qui vicino ai dati (pattern raccomandato) e per restringere il tipo di user.
export default async function ProjectsPage() {
  const supabase = await supabaseServer();
  const user = await currentUser(supabase);
  if (!user) redirect("/login");

  const [projects, profile] = await Promise.all([
    listProjects(supabase, user.id),
    getProfile(supabase, user.id),
  ]);
  if (profile && !profile.name) redirect("/onboarding");

  return (
    <>
      <AppHeader profileLabel={profile?.name ?? profile?.email} />

      <main className="flex w-full flex-1 flex-col gap-8 p-6">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-6">
          <div className="flex flex-col gap-2">
            <h1 className={pageTitleClass}>
              {STRINGS.projects.heading}
            </h1>
            <p className="font-mono text-sm text-foreground/60">{STRINGS.projects.intro}</p>
          </div>
          <Link href="/projects/new" className={`inline-flex items-center gap-2 ${primaryButtonClass}`}>
            <PlusIcon className="size-3.5" />
            {STRINGS.projects.newProject}
          </Link>
        </div>

        {projects.length === 0 ? (
          <p className="font-mono text-sm text-foreground/70">{STRINGS.projects.noneYet}</p>
        ) : (
          <ProjectList projects={projects} />
        )}
      </main>
    </>
  );
}
