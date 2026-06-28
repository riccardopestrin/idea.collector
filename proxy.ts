import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Transport edge (Next 16: ex-middleware). Rinfresca la sessione Supabase — i
// Server Component non possono riscrivere i cookie — e reindirizza chi non è
// loggato. Solo autenticazione, nessuna business logic: vedi layered-architecture.md.
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() valida il token col server Supabase e innesca il refresh dei cookie.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // /login e l'atterraggio del magic link sono pubblici: la callback deve poter
  // stabilire la sessione prima di qualsiasi guardia.
  const path = request.nextUrl.pathname;
  const isPublic = path === "/login" || path === "/auth/callback";
  if (!user && !isPublic) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (user && path === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
