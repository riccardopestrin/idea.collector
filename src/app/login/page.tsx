"use client";

import { useState } from "react";

import { controlClass } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import { STRINGS } from "@/lib/strings";
import { supabaseBrowser } from "@/lib/supabase/client";

// Login passwordless con magic link (vedi ADR-0001). L'utente riceve un link via
// email; cliccandolo atterra su /auth/callback che apre la sessione. Accesso solo
// su invito: shouldCreateUser:false, enforced da "signups disabilitati" in Supabase.
export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function sendLink() {
    setPending(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setPending(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-border p-8">
        <h1 className="text-xl font-semibold">{STRINGS.login.heading}</h1>

        {sent ? (
          <p role="status" className="text-sm">
            {STRINGS.login.sentBeforeEmail}
            <strong>{email}</strong>
            {STRINGS.login.sentAfterEmail}
          </p>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void sendLink();
            }}
            className="flex flex-col gap-4"
          >
            <label className="flex flex-col gap-1 text-sm" htmlFor="email">
              {STRINGS.login.emailLabel}
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={controlClass}
              />
            </label>

            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}

            <SubmitButton pending={pending}>{STRINGS.login.submit}</SubmitButton>
          </form>
        )}
      </div>
    </main>
  );
}
