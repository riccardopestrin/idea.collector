"use client";

import { useActionState } from "react";

import { updateName } from "@/app/profile/actions";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";

// Form condivisa da /onboarding e /profile: un solo campo, una sola action.
export function NameForm({
  heading,
  defaultName,
}: {
  heading: string;
  defaultName?: string;
}) {
  const [state, action, pending] = useActionState(updateName, null);

  return (
    <main className="flex flex-1 justify-center p-6">
      <form action={action} className="flex w-full max-w-lg flex-col gap-4">
        <h1 className="text-xl font-semibold">{heading}</h1>

        <Field label="Nome" name="name" required defaultValue={defaultName} />

        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}

        <SubmitButton pending={pending}>Salva</SubmitButton>
      </form>
    </main>
  );
}
