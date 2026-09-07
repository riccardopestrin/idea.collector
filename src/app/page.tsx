import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/nav/AppHeader";
import { ProjectCard } from "@/components/project/ProjectCard";
import { getProfile } from "@/lib/profiles";
import { listProjects } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";
import { supabaseServer } from "@/lib/supabase/server";

// Home autenticata: la lista dei progetti (bacheche) di cui l'utente è membro,
// con il "+" per crearne uno. Il proxy già blocca i non loggati; ricontrolliamo
// qui vicino ai dati (pattern raccomandato) e per restringere il tipo di user.
export default async function ProjectsPage() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [projects, profile] = await Promise.all([
    listProjects(supabase, user.id),
    getProfile(supabase, user.id),
  ]);
  if (profile && !profile.name) redirect("/onboarding");

  return (
    <>
      <AppHeader profileLabel={profile?.name ?? user.email} />

      <main className="flex w-full flex-1 flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{STRINGS.projects.heading}</h1>
            <p className="text-sm text-foreground/60">{STRINGS.projects.intro}</p>
          </div>
          <Link
            href="/projects/new"
            className="rounded-md bg-foreground px-4 py-2 text-sm text-background"
          >
            + {STRINGS.projects.newProject}
          </Link>
        </div>

        {projects.length === 0 ? (
          <p className="text-sm text-foreground/70">{STRINGS.projects.noneYet}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <li key={project.id}>
                <ProjectCard project={project} />
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
