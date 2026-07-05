"use client";

import { useActionState, useState } from "react";

import { submitRiceVote } from "@/app/proposals/[id]/actions";
import { SubmitButton } from "@/components/form/SubmitButton";
import { SectionTitle } from "@/components/detail/SectionTitle";

// Parametri votabili per metodo: RICE ha reach, ICE no (l'effort è la "facilità").
const PARAMS: Record<"rice" | "ice", { name: string; label: string }[]> = {
  rice: [
    { name: "reach", label: "Reach" },
    { name: "impact", label: "Impact" },
    { name: "confidence", label: "Confidence" },
    { name: "effort", label: "Effort" },
  ],
  ice: [
    { name: "impact", label: "Impact" },
    { name: "confidence", label: "Confidence" },
    { name: "effort", label: "Ease" },
  ],
};

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

// Form di voto RICE utente. Slider 1–10 per ogni parametro; un solo voto,
// immutabile (l'idoneità è decisa dal pannello, il service/RLS è il backstop).
export function RiceVoteForm({
  proposalId,
  method,
}: {
  proposalId: string;
  method: "rice" | "ice";
}) {
  const [state, action, pending] = useActionState(
    submitRiceVote.bind(null, proposalId),
    null,
  );

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border p-4">
      <SectionTitle>Il tuo voto {method.toUpperCase()}</SectionTitle>
      <form action={action} className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-x-6 gap-y-3">
          {PARAMS[method].map((p) => (
            <Slider key={p.name} name={p.name} label={p.label} />
          ))}
        </div>
        <p className="text-xs text-foreground/50">
          1 = minimo · 10 = massimo. Il voto è definitivo e non modificabile.
        </p>
        {state?.error && (
          <p role="alert" className="text-sm text-danger">
            {state.error}
          </p>
        )}
        <div>
          <SubmitButton pending={pending}>Invia voto</SubmitButton>
        </div>
      </form>
    </section>
  );
}
