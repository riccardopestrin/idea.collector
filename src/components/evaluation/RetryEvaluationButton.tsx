"use client";

import { useState, useTransition } from "react";

import { evaluateProposal } from "@/app/proposals/actions";
import { controlClass } from "@/components/form/Field";

// "Rilancia valutazione" (admin, su valutazione fallita): richiama la Server
// Action con force. Usato sia sulla card piccola sia nel pannello.
export function RetryEvaluationButton({ proposalId }: { proposalId: string }) {
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
            const result = await evaluateProposal(proposalId, true);
            if (result) setError(result.error);
          })
        }
        className={`${controlClass} w-fit text-xs disabled:opacity-50`}
      >
        Rilancia valutazione
      </button>
      {error && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
