import type { ProposalListItem } from "@/lib/proposals";

// Card di una proposta. Presentazionale: riceve la riga già letta; il wrapper
// (la <li> draggable della board) decide posizionamento e interazione.
export function ProposalCard({ proposal }: { proposal: ProposalListItem }) {
  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-background p-4">
      <span className="font-medium">{proposal.title}</span>
      {proposal.description && (
        <p className="line-clamp-2 text-sm text-foreground/70">{proposal.description}</p>
      )}
      <span className="text-xs text-foreground/50">
        di {proposal.proposer?.name ?? proposal.proposer?.email ?? "sconosciuto"}
      </span>
    </div>
  );
}
