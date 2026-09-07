import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { getProfile } from "@/lib/profiles";
import { getMemberRole, getProject } from "@/lib/projects";
import { supabaseServer } from "@/lib/supabase/server";

// Contesto comune delle pagine di un progetto: utente, progetto, ruolo. Il proxy
// già blocca i non loggati; qui si ricontrolla vicino ai dati. Un progetto
// inesistente o di cui non si è membri (RLS) è la stessa cosa: notFound.
// cache(): layout e pagina lo chiamano nella stessa richiesta, una sola lettura.
export const loadProject = cache(async (projectId: string) => {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [project, role, profile] = await Promise.all([
    getProject(supabase, projectId),
    getMemberRole(supabase, projectId, user.id),
    getProfile(supabase, user.id),
  ]);
  if (!project || !role) notFound();
  if (profile && !profile.name) redirect("/onboarding");

  return { supabase, user, project, role, profile };
});
