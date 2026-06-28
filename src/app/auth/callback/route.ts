import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

// Atterraggio del magic link: Supabase reindirizza qui con un ?code dopo aver
// verificato l'email. Lo scambiamo per la sessione (setta i cookie) e torniamo
// alla home. È un Route Handler perché qui i cookie sono scrivibili.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  // Code mancante o scaduto/invalido: torna al login per riprovare.
  return NextResponse.redirect(new URL("/login", request.url));
}
