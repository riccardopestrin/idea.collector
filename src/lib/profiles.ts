import type { SupabaseClient } from "@supabase/supabase-js";

export type Profile = {
  role: "admin" | "contributor";
  name: string | null;
};

// Profilo applicativo dell'utente (profiles.role + name). Seam unico per i check
// admin-gated e per l'onboarding nome; l'autorizzazione vera resta nel DB (trigger + RLS).
export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role, name")
    .eq("id", userId)
    .single();
  return data as Profile | null;
}
