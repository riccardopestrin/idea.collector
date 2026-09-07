import type { SupabaseClient } from "@supabase/supabase-js";

// Ruoli di progetto — mirror del check su project_members.role (migration 0021).
// Il ruolo vive SOLO sulla membership: chi crea il progetto è admin, e invita.
export const ROLES = ["admin", "contributor"] as const;
export type Role = (typeof ROLES)[number];

type Project = {
  id: string;
  name: string;
  // repo GitHub collegata (ex app_settings): contesto per la valutazione AI
  github_installation_id: number | null;
  github_owner: string | null;
  github_repo: string | null;
};

export type ProjectListItem = Pick<Project, "id" | "name" | "github_owner" | "github_repo"> & {
  role: Role;
  proposalCount: number;
};

export type Member = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
};

// Progetti dell'utente (la RLS "member read" restituisce solo i suoi), con il
// suo ruolo e il numero di proposte: la card della lista in home.
export async function listProjects(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProjectListItem[]> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, github_owner, github_repo, members:project_members(role), proposals(count)")
    // filtro sull'embed (path con l'alias): tiene solo la membership di chi guarda
    .eq("members.user_id", userId)
    .order("created_at", { ascending: true })
    .overrideTypes<
      (Pick<Project, "id" | "name" | "github_owner" | "github_repo"> & {
        members: { role: Role }[];
        proposals: { count: number }[];
      })[],
      { merge: false }
    >();
  return (data ?? []).map(({ members, proposals, ...project }) => ({
    ...project,
    // la RLS garantisce che chi vede il progetto ne è membro: l'indice è sicuro
    role: members[0].role,
    proposalCount: proposals[0]?.count ?? 0,
  }));
}

// null se non esiste o se l'utente non ne è membro (RLS): stesso esito, notFound.
export async function getProject(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Project | null> {
  const { data } = await supabase
    .from("projects")
    .select("id, name, github_installation_id, github_owner, github_repo")
    .eq("id", projectId)
    .maybeSingle();
  return data as Project | null;
}

// Ruolo dell'utente nel progetto; null = non membro. Seam unico dei guard
// admin nelle Server Action; l'autorizzazione vera resta nel DB (RLS + trigger).
export async function getMemberRole(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<Role | null> {
  const { data } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { role: Role } | null)?.role ?? null;
}

export async function isProjectAdmin(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
): Promise<boolean> {
  return (await getMemberRole(supabase, projectId, userId)) === "admin";
}

// Membri del progetto con il profilo, per la sezione impostazioni.
export async function listMembers(
  supabase: SupabaseClient,
  projectId: string,
): Promise<Member[]> {
  const { data } = await supabase
    .from("project_members")
    .select("user_id, role, profile:profiles(email, name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true })
    .overrideTypes<
      { user_id: string; role: Role; profile: { email: string; name: string | null } | null }[],
      { merge: false }
    >();
  return (data ?? []).map((m) => ({
    id: m.user_id,
    email: m.profile?.email ?? "",
    name: m.profile?.name ?? null,
    role: m.role,
  }));
}
