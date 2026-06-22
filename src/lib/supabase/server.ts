import { createServerClient } from "@supabase/ssr";
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
