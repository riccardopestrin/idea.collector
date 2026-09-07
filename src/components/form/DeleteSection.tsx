"use client";

import { useActionState, useRef } from "react";

import { SettingsHeading } from "@/components/form/SettingsHeading";
import {
  buttonClass,
  confirmDialogClass,
  dangerButtonClass,
  displayClass,
  settingsSectionClass,
} from "@/lib/tokens";
import { STRINGS } from "@/lib/strings";

export type DeleteTexts = {
  heading: string;
  intro: string;
  button: string;
  confirmBody: string;
  confirm: string;
};

// Sezione "zona pericolosa" (elimina progetto / elimina account): il bottone
// apre un <dialog> nativo di conferma (focus trap ed Esc gratis); la Server
// Action passata fa il resto e, se va bene, redirige. L'errore resta nel dialog.
export function DeleteSection({
  texts,
  confirmHeading,
  action,
}: {
  texts: DeleteTexts;
  confirmHeading: string;
  action: () => Promise<{ error: string } | null>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [state, submit, pending] = useActionState(async () => action(), null);

  return (
    <section className={settingsSectionClass}>
      <SettingsHeading heading={texts.heading} intro={texts.intro} />
      <div>
        <button type="button" onClick={() => ref.current?.showModal()} className={dangerButtonClass}>
          {texts.button}
        </button>
      </div>

      <dialog ref={ref} className={confirmDialogClass}>
        <h2 className={`${displayClass} text-xl`}>{confirmHeading}</h2>
        <p className="mt-3 text-sm text-foreground/70">{texts.confirmBody}</p>
        {state?.error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {state.error}
          </p>
        )}
        <form action={submit} className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={() => ref.current?.close()}
            disabled={pending}
            className={buttonClass}
          >
            {STRINGS.common.cancel}
          </button>
          <button type="submit" disabled={pending} className={dangerButtonClass}>
            {texts.confirm}
          </button>
        </form>
      </dialog>
    </section>
  );
}
