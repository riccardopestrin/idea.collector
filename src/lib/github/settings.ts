import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/lib/supabase/admin";

// Data layer per la repo GitHub collegata a un progetto (colonne github_* di
// projects, migration 0021). Lettura per i membri; scrittura SOLO lato server
// col client service-role (SEC-13, migration 0022): chi può chiamarla lo
// decidono i chiamanti (guard admin del progetto), come per gli esiti AI (0020).
export type GithubSettings = {
  github_installation_id: number | null;
  github_owner: string | null;
  github_repo: string | null;
};

export async function getGithubSettings(
  supabase: SupabaseClient,
  projectId: string,
): Promise<GithubSettings | null> {
  const { data } = await supabase
    .from("projects")
    .select("github_installation_id, github_owner, github_repo")
    .eq("id", projectId)
    .maybeSingle();
  return data as GithubSettings | null;
}

// Repo collegata come {owner, name}, o null se non (ancora) scelta.
export const connectedRepo = (s: Pick<GithubSettings, "github_owner" | "github_repo">) =>
  s.github_owner && s.github_repo ? { owner: s.github_owner, name: s.github_repo } : null;

export async function updateGithubSettings(
  projectId: string,
  settings: Partial<GithubSettings>,
): Promise<{ error: string } | null> {
  const { error } = await supabaseAdmin().from("projects").update(settings).eq("id", projectId);
  return error ? { error: error.message } : null;
}
