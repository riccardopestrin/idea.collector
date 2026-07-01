import {
  PROPOSAL_STATUSES,
  type ProposalListItem,
  type ProposalStatus,
} from "@/lib/proposals";

// SSOT della board (ADR-0002). L'ordine del flusso coincide oggi con l'ordine
// dell'enum DB; se mai divergessero, elencare qui l'ordine delle colonne.
export const BOARD_COLUMNS = PROPOSAL_STATUSES;

// Label IT degli stati — unico punto che traduce l'enum DB in testo utente.
export const STATUS_LABELS: Record<ProposalStatus, string> = {
  nuova: "Nuovo",
  in_valutazione: "In Valutazione",
  approvata: "Approvata",
  in_sviluppo: "In Sviluppo",
  rilasciata: "Rilasciata",
  parcheggiata: "Parcheggiata",
  rifiutata: "Rifiutata",
};

// Raggruppa le proposte per colonna preservando l'ordine di arrivo (la query
// ordina già per created_at). Ogni colonna esiste sempre, anche vuota.
export function groupByStatus(
  proposals: ProposalListItem[],
): Record<ProposalStatus, ProposalListItem[]> {
  const groups = {} as Record<ProposalStatus, ProposalListItem[]>;
  for (const status of BOARD_COLUMNS) groups[status] = [];
  for (const proposal of proposals) groups[proposal.status].push(proposal);
  return groups;
}
