"use client";

import Link from "next/link";

import { EvalStatusCue } from "@/components/evaluation/EvalStatusCue";
import { RetryEvaluationButton } from "@/components/evaluation/RetryEvaluationButton";
import { STATUS_LABELS } from "@/lib/board";
import {
  computeCompositeScore,
  formatScore,
  personLabel,
  type ProposalListItem,
} from "@/lib/proposals";

// Card di una proposta. Presentazionale: riceve la riga già letta; il wrapper
// (la <li> draggable della board) decide posizionamento e interazione.
// onDelete presente solo se chi guarda può eliminare (autore o admin);
// canRetryEval solo se admin (il "Rilancia" appare su valutazione fallita).
// showStatus mostra lo stato board della proposta: serve alla classifica, dove
// le proposte sono elencate per voto e non più raggruppate per colonna.
export function ProposalCard({
  proposal,
  onDelete,
  canRetryEval,
  showStatus,
}: {
  proposal: ProposalListItem;
  onDelete?: () => void;
  canRetryEval?: boolean;
  showStatus?: boolean;
}) {
  const score = computeCompositeScore(proposal, proposal.votes).total;
  return (
    <div className="relative flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
      {onDelete && (
        <button
          type="button"
          aria-label={`Elimina ${proposal.title}`}
          onClick={onDelete}
          // il click non deve avviare il drag della <li> che ci ospita
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="absolute right-1 top-1 rounded p-1.5 leading-none text-foreground/40 hover:text-foreground"
        >
          ×
        </button>
      )}
      <Link
        href={`/proposals/${proposal.id}`}
        // il click non deve avviare il drag della <li> che ci ospita
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="pr-6 font-medium underline-offset-2 hover:underline"
      >
        {proposal.title}
      </Link>
      <span className="flex items-center gap-2 text-xs text-foreground/50">
        di {personLabel(proposal.proposer)}
        <EvalStatusCue status={proposal.ai_eval_status} />
        {showStatus && (
          <span className="rounded-full border border-border px-2 py-0.5 font-medium text-foreground/70">
            {STATUS_LABELS[proposal.status]}
          </span>
        )}
        {score !== null && (
          <span
            className="ml-auto rounded-full border border-border px-2 py-0.5 font-medium text-foreground/80"
            title={`Voto ${proposal.method.toUpperCase()} · Claude + utenti`}
          >
            {formatScore(score)}
          </span>
        )}
      </span>
      {/* anche su in_corso: recupera valutazioni orfane di un crash (0011) */}
      {(proposal.ai_eval_status === "fallita" || proposal.ai_eval_status === "in_corso") &&
        canRetryEval && <RetryEvaluationButton proposalId={proposal.id} />}
    </div>
  );
}
