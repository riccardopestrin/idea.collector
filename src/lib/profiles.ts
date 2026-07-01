import type { SupabaseClient } from "@supabase/supabase-js";

// Ruolo applicativo dell'utente (profiles.role). Seam unico per i check
// admin-gated; l'autorizzazione vera resta nel DB (trigger + RLS).
export async function getRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<"admin" | "contributor" | null> {
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .single();
  return (data?.role as "admin" | "contributor") ?? null;
}
