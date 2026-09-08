"use client";

import { type CSSProperties, useActionState, useRef, useState } from "react";

import { submitRiceVote } from "@/app/proposals/[id]/actions";
import { SubmitButton } from "@/components/form/SubmitButton";
import { SectionTitle } from "@/components/detail/SectionTitle";
import type { ProposalStatus, VoteComponents } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";
import { ConfirmDialog } from "@/components/form/ConfirmDialog";
import { buttonClass, confirmActionsClass, primaryButtonClass } from "@/lib/tokens";

// I 4 fattori RICE-10 (ADR-0006), stessa scala per tutti. effort è "Ease".
const PARAMS = [
  { name: "reach", label: STRINGS.rice.factors.reach },
  { name: "impact", label: STRINGS.rice.factors.impact },
  { name: "confidence", label: STRINGS.rice.factors.confidence },
  { name: "effort", label: STRINGS.rice.factors.effort },
] as const;

function Slider({ name, label, initial }: { name: string; label: string; initial: number }) {
  const [value, setValue] = useState(initial);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between font-mono text-xs uppercase tracking-wider text-foreground/70">
        {label}
        <span className="text-base font-medium text-foreground">{value}</span>
      </span>
      <input
        type="range"
        name={name}
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        // riempimento della traccia in WebKit (vedi globals.css); scala 1–10
        style={{ "--value": `${((value - 1) / 9) * 100}%` } as CSSProperties}
        className="w-full"
      />
    </label>
  );
}

// Form di voto RICE-10 utente. Slider 1–10 per ogni fattore. Un voto per utente,
// ma modificabile (#8): se esiste già, gli slider partono dai valori votati e il
// submit lo aggiorna. Se la card non è "in valutazione" (#9d) il bottone apre un
// <dialog> di conferma (stesso pattern di DeleteSection) che poi invia il form.
export function RiceVoteForm({
  proposalId,
  status,
  existingVote,
}: {
  proposalId: string;
  status: ProposalStatus;
  existingVote: VoteComponents | null;
}) {
  const warnNotInEval = status !== "in_valutazione";
  const formRef = useRef<HTMLFormElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, action, pending] = useActionState(
    (prev: { error: string } | null, formData: FormData) => submitRiceVote(proposalId, prev, formData),
    null,
  );
  const label = existingVote ? STRINGS.rice.update : STRINGS.rice.submit;

  return (
    <section className="flex flex-col gap-3 border border-ink p-4">
      <SectionTitle>{STRINGS.rice.heading}</SectionTitle>
      <form ref={formRef} action={action} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {PARAMS.map((p) => (
            <Slider key={p.name} name={p.name} label={p.label} initial={existingVote?.[p.name] ?? 5} />
          ))}
        </div>
        <p className="font-mono text-xs text-foreground/50">{STRINGS.rice.legend}</p>
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <div>
          {warnNotInEval ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => dialogRef.current?.showModal()}
              className={primaryButtonClass}
            >
              {label}
            </button>
          ) : (
            <SubmitButton pending={pending}>{label}</SubmitButton>
          )}
        </div>
      </form>

      <ConfirmDialog ref={dialogRef} heading={STRINGS.rice.warnHeading} body={STRINGS.rice.warnBody}>
        <div className={confirmActionsClass}>
          <button type="button" onClick={() => dialogRef.current?.close()} className={buttonClass}>
            {STRINGS.common.cancel}
          </button>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              formRef.current?.requestSubmit();
            }}
            className={primaryButtonClass}
          >
            {label}
          </button>
        </div>
      </ConfirmDialog>
    </section>
  );
}
