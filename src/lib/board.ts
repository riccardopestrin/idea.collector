import type { ProposalListItem, ProposalStatus } from "@/lib/proposals";

// SSOT della board (ADR-0002). L'ordine del flusso diverge dall'enum DB:
// Archiviata va mostrata dopo Rifiutata.
export const BOARD_COLUMNS = [
  "nuova", "in_valutazione", "approvata", "in_sviluppo",
  "rilasciata", "rifiutata", "archiviata",
] as const satisfies readonly ProposalStatus[];

// Label IT degli stati — unico punto che traduce l'enum DB in testo utente.
export const STATUS_LABELS: Record<ProposalStatus, string> = {
  nuova: "Nuova",
  in_valutazione: "In Valutazione",
  approvata: "Approvata",
  in_sviluppo: "In Sviluppo",
  rilasciata: "Rilasciata",
  rifiutata: "Rifiutata",
  archiviata: "Archiviata",
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
