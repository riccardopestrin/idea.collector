import { createClient } from "@supabase/supabase-js";

// Client service-role: SOLO lato server (Server Action / service), mai in un
// Client Component. Bypassa RLS e column grant, quindi l'autorizzazione la fa
// chi lo chiama, prima. Usi: esiti scan/eval (SEC-9/SEC-8, migration 0020) e
// API auth.admin (inviti, rimozione utenti).
export function supabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY non configurata");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
