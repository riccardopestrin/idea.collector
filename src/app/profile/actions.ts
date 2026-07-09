"use server";

import { randomBytes } from "node:crypto";

import { refresh } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { listInstallationRepos } from "@/lib/github/app";
import { getGithubSettings, upsertGithubSettings } from "@/lib/github/settings";
import { getProfile } from "@/lib/profiles";
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
  if (!user) return { error: "Sessione scaduta. Rientra e riprova." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Il nome è obbligatorio." };
  // Backstop a DB: profiles_name_length_check (0008), stesso cap di 80.
  if (name.length > 80)
    return { error: "Il nome è troppo lungo (max 80 caratteri)." };

  const { error } = await supabase
    .from("profiles")
    .update({ name })
    .eq("id", user.id);
  if (error) return { error: "Errore nel salvataggio. Riprova." };

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
  if (!user) return { error: "Solo un admin può configurare GitHub." };

  const slug = process.env.GITHUB_APP_SLUG;
  if (!slug) return { error: "GitHub App non configurata (manca GITHUB_APP_SLUG)." };

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
  if (!user) return { error: "Solo un admin può configurare GitHub." };

  const settings = await getGithubSettings(supabase);
  if (!settings?.github_installation_id) {
    return { error: "Nessuna autorizzazione GitHub attiva. Connetti GitHub prima." };
  }

  const value = String(formData.get("repo") ?? "");
  const [owner, name] = value.split("/");
  const repos = await listInstallationRepos(settings.github_installation_id);
  if (!repos.some((r) => r.owner === owner && r.name === name)) {
    return { error: "Repo non coperta dall'autorizzazione GitHub." };
  }

  const result = await upsertGithubSettings(supabase, user.id, {
    github_owner: owner,
    github_repo: name,
  });
  if (result) return { error: "Errore nel salvataggio. Riprova." };

  refresh();
  return null;
}

// Scollega GitHub: azzera la config. La revoca dell'autorizzazione su
// github.com resta un passo manuale dell'owner (nessuna API di disinstallazione qui).
export async function disconnectGithub(): Promise<ActionResult> {
  const { supabase, user } = await requireAdmin();
  if (!user) return { error: "Solo un admin può configurare GitHub." };

  const result = await upsertGithubSettings(supabase, user.id, {
    github_installation_id: null,
    github_owner: null,
    github_repo: null,
  });
  if (result) return { error: "Errore nel salvataggio. Riprova." };

  refresh();
  return null;
}
