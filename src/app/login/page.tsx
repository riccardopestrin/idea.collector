"use client";

import { useState } from "react";

import { SubmitButton } from "@/components/form/SubmitButton";
import { Wordmark } from "@/components/nav/Wordmark";
import { STRINGS } from "@/lib/strings";
import { supabaseBrowser } from "@/lib/supabase/client";
import { controlClass, displayClass, labelClass } from "@/lib/tokens";

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
      <div className="flex w-full max-w-sm flex-col gap-6 border border-ink bg-paper p-8 shadow-hard-lg">
        <div className="flex flex-col gap-4">
          <Wordmark className="text-2xl" />
          <h1 className={`${displayClass} text-4xl`}>{STRINGS.login.heading}</h1>
        </div>

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
            className="flex flex-col gap-5"
          >
            <label className="flex flex-col gap-1.5" htmlFor="email">
              <span className={labelClass}>{STRINGS.login.emailLabel}</span>
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
