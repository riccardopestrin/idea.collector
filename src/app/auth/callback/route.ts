import { NextResponse, type NextRequest } from "next/server";

import { supabaseServer } from "@/lib/supabase/server";

// Atterraggio del magic link: Supabase reindirizza qui con un ?code dopo aver
// verificato l'email. Lo scambiamo per la sessione (setta i cookie) e torniamo
// alla home. È un Route Handler perché qui i cookie sono scrivibili.
// Invito admin e cambio email (template in supabase/templates/) arrivano invece
// con ?token_hash&type=…: li verifichiamo qui server-side (verifyOtp).
const OTP_TYPES = ["invite", "email_change"] as const;
type OtpType = (typeof OTP_TYPES)[number];

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as OtpType | null;
  const otp = tokenHash && type && OTP_TYPES.includes(type) ? { type, token_hash: tokenHash } : null;
  if (code || otp) {
    const supabase = await supabaseServer();
    const { error } = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : await supabase.auth.verifyOtp(otp!);
    if (!error) return NextResponse.redirect(new URL("/", request.url));
  }
  // Code mancante o scaduto/invalido: torna al login per riprovare.
  return NextResponse.redirect(new URL("/login", request.url));
}
