import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

// Atterraggio del magic link: Supabase reindirizza qui con un ?code dopo aver
// verificato l'email. Lo scambiamo per la sessione (setta i cookie) e torniamo
// alla home. È un Route Handler perché qui i cookie sono scrivibili.
// L'invito admin (template supabase/templates/invite.html) arriva invece con
// ?token_hash&type=invite: lo verifichiamo qui server-side (verifyOtp).
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  if (code || (tokenHash && params.get("type") === "invite")) {
    const supabase = await supabaseServer();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp({ type: "invite", token_hash: tokenHash! });
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  // Code mancante o scaduto/invalido: torna al login per riprovare.
  return NextResponse.redirect(new URL("/login", request.url));
}
