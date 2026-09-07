"use client";

import Link from "next/link";

import { EvalStatusCue } from "@/components/evaluation/EvalStatusCue";
import { RetryButton } from "@/components/evaluation/RetryButton";
import { XIcon } from "@/components/icons";
import {
  computeCompositeScore,
  formatScore,
  personLabel,
  type ProposalListItem,
} from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";
import { liftClass, tagClass } from "@/lib/tokens";

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
    <div className={`relative flex flex-col gap-2 border border-ink bg-paper p-4 ${liftClass}`}>
      {onDelete && (
        <button
          type="button"
          aria-label={STRINGS.card.deleteAria(proposal.title)}
          onClick={onDelete}
          // il click non deve avviare il drag della <li> che ci ospita
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="absolute right-0 top-0 border-b border-l border-ink p-1.5 text-foreground/50 hover:bg-ink hover:text-paper"
        >
          <XIcon className="size-3" />
        </button>
      )}
      <Link
        href={`/proposals/${proposal.id}`}
        // il click non deve avviare il drag della <li> che ci ospita
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="pr-6 font-medium leading-snug hover:text-paprika"
      >
        {proposal.title}
      </Link>
      <span className="flex flex-wrap items-center gap-2 font-mono text-xs text-foreground/60">
        {/* co-autori: proposer + autori dei contributi accettati (migration 0016) */}
        {STRINGS.card.byLine([proposal.proposer, ...proposal.contributors].map(personLabel).join(", "))}
        <EvalStatusCue status={proposal.ai_eval_status} />
        {/* RFC-006: bloccata in 'nuova' finché non differenziata o rifiutata */}
        {proposal.dup_flagged && (
          <span className={`${tagClass} border-paprika text-paprika`}>{STRINGS.card.dupBadge}</span>
        )}
        {showStatus && (
          <span className={`${tagClass} border-ink text-foreground/70`}>{STRINGS.status[proposal.status]}</span>
        )}
        {score !== null && (
          <span
            className={`ml-auto ${tagClass} border-ink bg-ink text-paper`}
            title={STRINGS.card.scoreTitle}
          >
            {formatScore(score)}
          </span>
        )}
      </span>
      {/* anche su in_corso: recupera valutazioni orfane di un crash (0011) */}
      {(proposal.ai_eval_status === "fallita" || proposal.ai_eval_status === "in_corso") &&
        canRetryEval && <RetryButton proposalId={proposal.id} />}
    </div>
  );
}
