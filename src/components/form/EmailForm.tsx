"use client";

import { useState } from "react";

import { Field } from "@/components/form/Field";
import { SettingsHeading } from "@/components/form/SettingsHeading";
import { SubmitButton } from "@/components/form/SubmitButton";
import { STRINGS } from "@/lib/strings";
import { supabaseBrowser } from "@/lib/supabase/client";
import { settingsSectionClass } from "@/lib/tokens";

// Cambio email dal profilo. Come il login parla con GoTrue dal browser:
// updateUser manda il link di conferma a entrambe le caselle (secure email
// change, template email_change.html → /auth/callback); a conferma avvenuta il
// trigger sync_profile_email (0025) allinea profiles.email.
export function EmailForm({ currentEmail }: { currentEmail: string }) {
  const [sent, setSent] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    if (email === currentEmail.toLowerCase()) {
      setError(STRINGS.profile.email.same);
      return;
    }
    setPending(true);
    setError(null);
    const { error } = await supabaseBrowser().auth.updateUser({ email });
    setPending(false);
    if (error) setError(STRINGS.profile.email.failed);
    else setSent(email);
  }

  return (
    <form action={submit} className={settingsSectionClass}>
      <SettingsHeading heading={STRINGS.profile.email.heading} intro={STRINGS.profile.email.intro} />
      <Field
        label={STRINGS.profile.email.label}
        name="email"
        type="email"
        required
        defaultValue={currentEmail}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {sent && (
        <p role="status" className="font-mono text-sm text-foreground/70">
          {STRINGS.profile.email.sent(sent)}
        </p>
      )}
      <div>
        <SubmitButton pending={pending}>{STRINGS.profile.email.submit}</SubmitButton>
      </div>
    </form>
  );
}
