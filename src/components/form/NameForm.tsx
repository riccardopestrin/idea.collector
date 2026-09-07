"use client";

import { useRouter } from "next/navigation";
import { useActionState } from "react";

import { updateName } from "@/app/profile/actions";
import { Field } from "@/components/form/Field";
import { SubmitButton } from "@/components/form/SubmitButton";
import { STRINGS } from "@/lib/strings";
import { displayClass } from "@/lib/tokens";

// Form condivisa da /onboarding, /profile e dall'overlay profilo: un solo campo,
// una sola action. backOnSave: nell'overlay il salvataggio chiude il modal
// (router.back) e si resta sulla pagina da cui lo si era aperto.
export function NameForm({
  heading,
  defaultName,
  backOnSave = false,
}: {
  heading: string;
  defaultName?: string;
  backOnSave?: boolean;
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      const result = await updateName(prev, formData);
      if (!result && backOnSave) router.back();
      return result;
    },
    null,
  );

  return (
    <form action={action} className="flex w-full max-w-lg flex-col gap-5">
      <h1 className={`${displayClass} text-3xl`}>{heading}</h1>

      <Field label={STRINGS.profile.nameLabel} name="name" required defaultValue={defaultName} />

      {state?.error && (
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      )}

      <div>
        <SubmitButton pending={pending}>{STRINGS.common.save}</SubmitButton>
      </div>
    </form>
  );
}
