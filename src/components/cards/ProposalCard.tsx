import Link from "next/link";

import { personLabel, type ProposalListItem } from "@/lib/proposals";

// Card di una proposta. Presentazionale: riceve la riga già letta; il wrapper
// (la <li> draggable della board) decide posizionamento e interazione.
// onDelete presente solo se chi guarda può eliminare (autore o admin).
export function ProposalCard({
  proposal,
  onDelete,
}: {
  proposal: ProposalListItem;
  onDelete?: () => void;
}) {
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
      {proposal.description && (
        <p className="line-clamp-2 text-sm text-foreground/70">{proposal.description}</p>
      )}
      <span className="text-xs text-foreground/50">
        di {personLabel(proposal.proposer)}
      </span>
    </div>
  );
}
