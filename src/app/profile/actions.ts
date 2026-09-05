"use server";

import { randomBytes } from "node:crypto";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { listInstallationRepos } from "@/lib/github/app";
import { getGithubSettings, upsertGithubSettings } from "@/lib/github/settings";
import { getProfile, type Role, ROLES } from "@/lib/profiles";
import { STRINGS } from "@/lib/strings";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { supabaseServer } from "@/lib/supabase/server";

type UpdateNameState = { error: string } | null;

// Imposta/aggiorna profiles.name dell'utente corrente. La RLS "self update"
// (+ grant colonna name) garantisce che possa scrivere solo la propria riga.
export async function updateName(
  _prev: UpdateNameState,
  formData: FormData
): Promise<UpdateNameState> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: STRINGS.errors.sessionExpired };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: STRINGS.profile.nameRequired };
  // Backstop a DB: profiles_name_length_check (0008), stesso cap di 80.
  if (name.length > 80) return { error: STRINGS.profile.nameTooLong };

  const { error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("id", user.id);
  if (error) return { error: STRINGS.errors.saveFailed };

  redirect("/");
}

type ActionResult = { error: string } | null;

// Guard comune delle azioni GitHub: sessione valida + ruolo admin.
async function requireAdmin() {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null };
  const isAdmin = (await getProfile(supabase, user.id))?.role === "admin";
  return { supabase, user: isAdmin ? user : null };
}

// Avvia il flusso "Connetti GitHub": nonce anti-CSRF in cookie httpOnly +
// redirect all'install URL con ?state — GitHub lo rimanda al callback, che lo
// confronta col cookie. Senza, un link confezionato a un admin poteva puntare
// la config a un'installazione altrui (review chain 2026-07-03, finding [4]).
export async function startGithubConnect(): Promise<ActionResult> {
  const { user } = await requireAdmin();
  if (!user) return { error: STRINGS.github.adminOnly };

  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return { error: STRINGS.github.appNotConfigured };

  const state = randomBytes(16).toString("hex");
  (await cookies()).set("github_connect_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  redirect(`https://github.com/apps/${slug}/installations/new?state=${state}`);
}

// Seleziona la repo del progetto tra quelle coperte dall'autorizzazione.
// Admin-only; il valore arriva dal <select> come "owner/name" e viene
// rivalidato contro la lista reale (trust boundary).
export async function selectRepo(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: STRINGS.github.adminOnly };

  const settings = await getGithubSettings(supabase);
  if (!settings?.github_installation_id) {
    return { error: STRINGS.github.noInstallation };
  }

  const value = String(formData.get("repo") ?? "");
  const [owner, name] = value.split("/");
  const repos = await listInstallationRepos(settings.github_installation_id);
  if (!repos.some((r) => r.owner === owner && r.name === name)) {
    return { error: STRINGS.github.repoNotAllowed };
  }

  const result = await upsertGithubSettings(supabase, user.id, {
    github_owner: owner,
    github_repo: name,
  });
  if (result) return { error: STRINGS.errors.saveFailed };

  refresh();
  return null;
}

// Scollega GitHub: azzera la config. La revoca dell'autorizzazione su
// github.com resta un passo manuale dell'owner (nessuna API di disinstallazione qui).
export async function disconnectGithub(): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: STRINGS.github.adminOnly };

  const result = await upsertGithubSettings(supabase, user.id, {
    github_installation_id: null,
    github_owner: null,
    github_repo: null,
  });
  if (result) return { error: STRINGS.errors.saveFailed };

  refresh();
  return null;
}

// --- Gestione utenti (admin) ---
//
// Accesso solo su invito: l'admin crea l'utente via auth.admin (service-role,
// manda l'email con il link) — il trigger handle_new_user crea il profilo
// contributor; il ruolo si cambia con la RPC set_profile_role (is_admin() a DB,
// migration 0020). "Rimuovere" = disabilitare (ban): un hard-delete è bloccato
// dalle FK verso profiles (proposte, commenti, voti, status_history) per
// chiunque abbia mai fatto qualcosa, e cancellerebbe l'audit trail.

const isRole = (value: string): value is Role => ROLES.includes(value as Role);

export async function inviteUser(
  _prev: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: STRINGS.users.adminOnly };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  // trust boundary: forma minima, il resto lo valida GoTrue
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { error: STRINGS.users.invalidEmail };
  const asAdmin = formData.get("admin") === "on";

  const { data, error } = await supabaseAdmin().auth.admin.inviteUserByEmail(email);
  if (error) {
    console.error("inviteUser:", error);
    return { error: STRINGS.users.inviteFailed };
  }
  if (asAdmin) {
    const { error: roleError } = await supabase.rpc("set_profile_role", {
      p_id: data.user.id,
      p_role: "admin",
    });
    if (roleError) {
      console.error("inviteUser role:", roleError);
      return { error: STRINGS.errors.saveFailed };
    }
  }

  refresh();
  return null;
}

export async function setUserRole(userId: string, role: string): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: STRINGS.users.adminOnly };
  if (!isRole(role)) return { error: STRINGS.users.invalidRole };
  if (userId === user.id) return { error: STRINGS.users.ownRole };

  const { error } = await supabase.rpc("set_profile_role", { p_id: userId, p_role: role });
  if (error) {
    console.error("setUserRole:", error);
    return { error: STRINGS.errors.saveFailed };
  }

  refresh();
  return null;
}

// ban_duration "none" riabilita; ~100 anni = disabilitato. GoTrue rifiuta
// login e refresh di un utente bannato (il token corrente scade entro 1h).
export async function setUserDisabled(userId: string, disabled: boolean): Promise<ActionResult> {
  const { user } = await requireAdmin();
  if (!user) return { error: STRINGS.users.adminOnly };
  if (userId === user.id) return { error: STRINGS.users.disableSelf };

  const { error } = await supabaseAdmin().auth.admin.updateUserById(userId, {
    ban_duration: disabled ? "876600h" : "none",
  });
  if (error) {
    console.error("setUserDisabled:", error);
    return { error: STRINGS.users.disableFailed };
  }

  refresh();
  return null;
}
