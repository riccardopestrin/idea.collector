"use client";

import { useActionState, useState } from "react";

import { submitRiceVote } from "@/app/proposals/[id]/actions";
import { SubmitButton } from "@/components/form/SubmitButton";
import { SectionTitle } from "@/components/detail/SectionTitle";
import { STRINGS } from "@/lib/strings";

// I 4 fattori RICE-10 (ADR-0006), stessa scala per tutti. effort è "Ease".
const PARAMS = [
  { name: "reach", label: STRINGS.rice.factors.reach },
  { name: "impact", label: STRINGS.rice.factors.impact },
  { name: "confidence", label: STRINGS.rice.factors.confidence },
  { name: "effort", label: STRINGS.rice.factors.effort },
] as const;

function Slider({ name, label }: { name: string; label: string }) {
  const [value, setValue] = useState(5);
  return (
    <label className="flex flex-col gap-1">
      <span className="flex items-center justify-between text-sm text-foreground/70">
        {label}
        <span className="font-semibold text-foreground">{value}</span>
      </span>
      <input
        type="range"
        name={name}
        min={1}
        max={10}
        step={1}
        value={value}
        onChange={(e) => setValue(Number(e.target.value))}
        className="w-full accent-foreground"
      />
    </label>
  );
}

// Form di voto RICE-10 utente. Slider 1–10 per ogni fattore; un solo voto,
// immutabile (l'idoneità è decisa dal pannello, il service/RLS è il backstop).
export function RiceVoteForm({ proposalId }: { proposalId: string }) {
  const [state, action, pending] = useActionState(
    submitRiceVote.bind(null, proposalId),
    null,
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <SectionTitle>{STRINGS.rice.heading}</SectionTitle>
      <form action={action} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {PARAMS.map((p) => (
            <Slider key={p.name} name={p.name} label={p.label} />
          ))}
        </div>
        <p className="text-xs text-foreground/50">{STRINGS.rice.legend}</p>
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <div>
          <SubmitButton pending={pending}>{STRINGS.rice.submit}</SubmitButton>
        </div>
      </form>
    </section>
  );
}
