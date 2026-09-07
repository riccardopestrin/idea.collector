"use client";

import { useState, useTransition } from "react";

import { evaluateProposal, runProposalScanAction } from "@/app/proposals/actions";
import { smallButtonClass } from "@/lib/tokens";
import { STRINGS } from "@/lib/strings";

// "Rilancia" su un run AI fallito (o in_corso orfano di un crash, 0011):
// richiama la Server Action con force. kind: 'eval' = valutazione RICE
// (admin), 'scan' = scan duplicati (proposer o admin, RFC-006). Usato sia
// sulla card piccola sia nel pannello. Un run fallito finisce sulla riga e lo
// mostra chi ci ospita; qui compaiono solo gli errori non persistiti.
const KINDS = {
  eval: { label: STRINGS.evaluation.retryEval, action: evaluateProposal },
  scan: { label: STRINGS.evaluation.retryScan, action: runProposalScanAction },
} as const;

export function RetryButton({
  proposalId,
  kind = "eval",
}: {
  proposalId: string;
  kind?: keyof typeof KINDS;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <span className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        // il click non deve avviare il drag della card che ci ospita
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const result = await KINDS[kind].action(proposalId, true);
            if (result) setError(result.error);
          })
        }
        className={`${smallButtonClass} w-fit`}
      >
        {KINDS[kind].label}
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
