import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Client per Server Components / Server Actions. Legge la sessione dai cookie.
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          // In un Server Component i set falliscono: il refresh lo fa il proxy. Ignora.
          try {
            list.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {}
        },
      },
    }
  );
}

// Identità (solo id) dal JWT già validato dal proxy. getClaims() verifica la firma
// in locale (JWKS in cache) e risparmia il round trip all'Auth server di getUser();
// con la legacy JWT secret (HS256) ricade da solo su getUser(). Email e nome si
// leggono da profiles (getProfile): le claims restano stantie fino al refresh.
export async function currentUser(supabase: SupabaseClient) {
  const { data } = await supabase.auth.getClaims();
  return data ? { id: data.claims.sub } : null;
}
