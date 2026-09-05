import type { SupabaseClient } from "@supabase/supabase-js";

// Data layer per app_settings (riga singola, migration 0010): config del repo
// GitHub collegato. Lettura per tutti gli autenticati; scrittura admin (RLS backstop).
export type GithubSettings = {
  github_installation_id: number | null;
  github_owner: string | null;
  github_repo: string | null;
};

export async function getGithubSettings(
  supabase: SupabaseClient,
): Promise<GithubSettings | null> {
  const { data } = await supabase
    .from("app_settings")
    .select("github_installation_id, github_owner, github_repo")
    .maybeSingle();
  return data as GithubSettings | null;
}

// Repo collegata come {owner, name}, o null se non (ancora) scelta.
export const connectedRepo = (s: GithubSettings | null) =>
  s?.github_owner && s.github_repo ? { owner: s.github_owner, name: s.github_repo } : null;

export async function upsertGithubSettings(
  supabase: SupabaseClient,
  userId: string,
  settings: Partial<GithubSettings>,
): Promise<{ error: string } | null> {
  const { error } = await supabase
    .from("app_settings")
    .upsert({ id: true, ...settings, updated_by: userId, updated_at: new Date().toISOString() });
  return error ? { error: error.message } : null;
}
