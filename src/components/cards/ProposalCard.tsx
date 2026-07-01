import type { ProposalListItem } from "@/lib/proposals";

// Card di una proposta nella lista. Presentazionale: riceve la riga già letta.
export function ProposalCard({ proposal }: { proposal: ProposalListItem }) {
  return (
    <li className="flex flex-col gap-1 rounded-lg border border-border p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium">{proposal.title}</span>
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs text-foreground/70">
          {proposal.status}
        </span>
      </div>
      {proposal.description && (
        <p className="line-clamp-2 text-sm text-foreground/70">{proposal.description}</p>
      )}
      <span className="text-xs text-foreground/50">
        di {proposal.proposer?.name ?? proposal.proposer?.email ?? "sconosciuto"}
      </span>
    </li>
  );
}
