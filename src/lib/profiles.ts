import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  name: string | null;
};

// Profilo applicativo dell'utente (profiles.name). Il ruolo non vive più qui:
// è per progetto, su project_members (migration 0021, src/lib/projects.ts).
export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("name")
    .eq("id", userId)
    .single();
  return data as Profile | null;
}
