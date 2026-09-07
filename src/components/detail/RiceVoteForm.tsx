"use client";

import { useActionState, useState } from "react";

import { submitRiceVote } from "@/app/proposals/[id]/actions";
import { SubmitButton } from "@/components/form/SubmitButton";
import { SectionTitle } from "@/components/detail/SectionTitle";
import type { ProposalStatus, VoteComponents } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";

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
        className="w-full"
      />
    </label>
  );
}

// Form di voto RICE-10 utente. Slider 1–10 per ogni fattore. Un voto per utente,
// ma modificabile (#8): se esiste già, gli slider partono dai valori votati e il
// submit lo aggiorna. Se la card non è "in valutazione" (#9d) si conferma prima.
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
  const [state, action, pending] = useActionState(
    async (prev: { error: string } | null, formData: FormData) => {
      if (warnNotInEval && !window.confirm(STRINGS.rice.warnNotInEval)) return prev;
      return submitRiceVote(proposalId, prev, formData);
    },
    null,
  );

  return (
    <section className="flex flex-col gap-3 border border-ink p-4">
      <SectionTitle>{STRINGS.rice.heading}</SectionTitle>
      <form action={action} className="flex flex-col gap-3">
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
          <SubmitButton pending={pending}>
            {existingVote ? STRINGS.rice.update : STRINGS.rice.submit}
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
