"use server";

import { randomBytes } from "node:crypto";

import { refresh, revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { listInstallationRepos } from "@/lib/github/app";
import { getGithubSettings, updateGithubSettings } from "@/lib/github/settings";
import { isProjectAdmin, type Role, ROLES } from "@/lib/projects";
import { STRINGS } from "@/lib/strings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type ActionResult = { error: string } | null;

// Crea un progetto: la RPC create_project (migration 0021) inserisce progetto e
// membership admin del creatore in una transazione. Con la spunta "collega repo"
// si atterra sulle impostazioni, dove vive il flusso GitHub App.
export async function createProject(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: STRINGS.projects.nameRequired };
  // backstop a DB: check su projects.name, stesso cap di 80
  if (name.length > 80) return { error: STRINGS.projects.nameTooLong };

  const { data: id, error } = await supabase.rpc("create_project", { p_name: name });
  if (error || !id) {
    console.error("createProject:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  const connectRepo = formData.get("connect_repo") === "on";
  redirect(connectRepo ? `/projects/${id}/settings` : `/projects/${id}`);
}

// Guard comune: sessione valida + admin del progetto (RLS come backstop).
async function requireProjectAdmin(projectId: string) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  const admin = await isProjectAdmin(supabase, projectId, user.id);
  return { supabase, user: admin ? user : null };
}

// Rinomina il progetto. Solo admin (guard nel service, policy "admin update(name)"
// di 0021 come backstop). Il nome compare in lista progetti, board e classifica:
// si rivalida tutto il tree sotto il root layout.
export async function renameProject(
  projectId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireProjectAdmin(projectId);
  if (!user) return { error: STRINGS.projects.rename.adminOnly };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: STRINGS.projects.nameRequired };
  if (name.length > 80) return { error: STRINGS.projects.nameTooLong };

  const { error } = await supabase.from("projects").update({ name }).eq("id", projectId);
  if (error) {
    console.error("renameProject:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  revalidatePath("/", "layout");
  return null;
}

// Riordina le bacheche in home per l'utente corrente (#6). La RPC reorder_projects
// (0029, definer) scrive la position solo sulle membership di auth.uid(): ogni
// membro riordina la propria lista, nessun controllo di ruolo. Gli id non-membri
// nell'array vengono semplicemente ignorati dalla RPC.
export async function reorderProjects(orderedIds: string[]): Promise<ActionResult> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const { error } = await supabase.rpc("reorder_projects", { p_ids: orderedIds });
  if (error) {
    console.error("reorderProjects:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  revalidatePath("/");
  return null;
}

// --- Membri ---
//
// Accesso solo su invito: l'admin del progetto invita via auth.admin
// (service-role, manda l'email con il link) — il trigger handle_new_user crea il
// profilo — e aggiunge la membership. Chi ha già un account (altro progetto)
// viene solo aggiunto. Rimuovere = cancellare la membership (policy 0021, mai
// sulla propria riga).

const isRole = (value: string): value is Role => ROLES.includes(value as Role);

export type InviteResult = { error: string } | { invited: string } | { added: string };

export async function inviteMember(
  projectId: string,
  _prev: InviteResult | null,
  formData: FormData,
): Promise<InviteResult> {
  const { supabase, user } = await requireProjectAdmin(projectId);
  if (!user) return { error: STRINGS.members.adminOnly };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // trust boundary: forma minima, il resto lo valida GoTrue
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: STRINGS.members.invalidEmail };
  const role: Role = formData.get("admin") === "on" ? "admin" : "contributor";

  const admin = supabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
  let userId = data?.user?.id;
  if (error) {
    // già registrato (GoTrue rifiuta l'invito): il profilo non è visibile al
    // chiamante finché non è co-membro, quindi la lookup è service-role
    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (!existing) {
      console.error("inviteMember:", error);
      return { error: STRINGS.members.inviteFailed };
    }
    userId = existing.id;
  }

  const { error: memberError } = await supabase
    .from("project_members")
    .insert({ project_id: projectId, user_id: userId, role });
  if (memberError) {
    // 23505 = unique_violation: già membro
    if (memberError.code === "23505") return { error: STRINGS.members.alreadyMember };
    console.error("inviteMember membership:", memberError);
    return { error: STRINGS.errors.saveFailed };
  }

  refresh();
  return error ? { added: email } : { invited: email };
}

export async function setMemberRole(
  projectId: string,
  userId: string,
  role: string,
): Promise<ActionResult> {
  const { supabase, user } = await requireProjectAdmin(projectId);
  if (!user) return { error: STRINGS.members.adminOnly };
  if (!isRole(role)) return { error: STRINGS.members.invalidRole };
  if (userId === user.id) return { error: STRINGS.members.ownRole };

  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) {
    console.error("setMemberRole:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  refresh();
  return null;
}

export async function removeMember(projectId: string, userId: string): Promise<ActionResult> {
  const { supabase, user } = await requireProjectAdmin(projectId);
  if (!user) return { error: STRINGS.members.adminOnly };
  if (userId === user.id) return { error: STRINGS.members.removeSelf };

  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("project_id", projectId)
    .eq("user_id", userId);
  if (error) {
    console.error("removeMember:", error);
    return { error: STRINGS.members.removeFailed };
  }

  refresh();
  return null;
}

// --- GitHub (ADR-0004) ---

// Avvia il flusso "Connetti GitHub": nonce anti-CSRF + id progetto in cookie
// httpOnly, redirect all'install URL con ?state — GitHub lo rimanda al callback,
// che lo confronta col cookie e sa su quale progetto scrivere. Senza il nonce un
// link confezionato a un admin poteva puntare la config a un'installazione altrui.
export async function startGithubConnect(projectId: string): Promise<ActionResult> {
  const { user } = await requireProjectAdmin(projectId);
  if (!user) return { error: STRINGS.github.adminOnly };

  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return { error: STRINGS.github.appNotConfigured };

  const state = randomBytes(16).toString("hex");
  (await cookies()).set("github_connect_state", `${state}.${projectId}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  redirect(`https://github.com/apps/${slug}/installations/new?state=${state}`);
}

// Seleziona la repo del progetto tra quelle coperte dall'autorizzazione. Il
// valore arriva dal <select> come "owner/name" e viene rivalidato contro la
// lista reale (trust boundary).
export async function selectRepo(
  projectId: string,
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireProjectAdmin(projectId);
  if (!user) return { error: STRINGS.github.adminOnly };

  const settings = await getGithubSettings(supabase, projectId);
  if (!settings?.github_installation_id) {
    return { error: STRINGS.github.noInstallation };
  }

  const value = String(formData.get("repo") ?? "");
  const [owner, name] = value.split("/");
  const repos = await listInstallationRepos(settings.github_installation_id);
  if (!repos.some((r) => r.owner === owner && r.name === name)) {
    return { error: STRINGS.github.repoNotAllowed };
  }

  const result = await updateGithubSettings(projectId, {
    github_owner: owner,
    github_repo: name,
  });
  if (result) return { error: STRINGS.errors.saveFailed };

  refresh();
  return null;
}

// Scollega GitHub dal progetto: azzera la config. La revoca dell'autorizzazione
// su github.com resta un passo manuale (nessuna API di disinstallazione qui).
export async function disconnectGithub(projectId: string): Promise<ActionResult> {
  const { user } = await requireProjectAdmin(projectId);
  if (!user) return { error: STRINGS.github.adminOnly };

  const result = await updateGithubSettings(projectId, {
    github_installation_id: null,
    github_owner: null,
    github_repo: null,
  });
  if (result) return { error: STRINGS.errors.saveFailed };

  refresh();
  return null;
}

// Elimina il progetto con membri e proposte (cascade FK, policy 0023). È
// irreversibile: la conferma vive nel dialog lato client, qui solo il guard.
export async function deleteProject(projectId: string): Promise<ActionResult> {
  const { supabase, user } = await requireProjectAdmin(projectId);
  if (!user) return { error: STRINGS.projects.delete.adminOnly };

  const { error } = await supabase.from("projects").delete().eq("id", projectId);
  if (error) {
    console.error("deleteProject:", error);
    return { error: STRINGS.projects.delete.failed };
  }
  redirect("/");
}
