import type { ProposalListItem, ProposalStatus } from "@/lib/proposals";

// SSOT della board (ADR-0002). L'ordine del flusso diverge dall'enum DB:
// Archiviata va mostrata dopo Rifiutata.
export const BOARD_COLUMNS = [
  "nuova", "in_valutazione", "approvata", "in_sviluppo",
  "rilasciata", "rifiutata", "archiviata",
] as const satisfies readonly ProposalStatus[];

// Macchina a stati della board (branch cardDirections): transizioni consentite
// per il drag. DELETE non è una colonna — è l'azione trash, disponibile su ogni
// card (autore/admin) da qualsiasi stato, con conferma. 'rifiutata' è terminale
// (solo DELETE): è la safeguard prima della cancellazione irreversibile.
export const ALLOWED_TRANSITIONS: Record<ProposalStatus, readonly ProposalStatus[]> = {
  nuova: ["in_valutazione", "rifiutata"],
  in_valutazione: ["approvata", "rifiutata", "archiviata"],
  approvata: ["in_sviluppo", "rifiutata"],
  in_sviluppo: ["rilasciata", "archiviata", "rifiutata"],
  rilasciata: ["rifiutata"],
  rifiutata: [],
  archiviata: ["in_valutazione", "approvata", "in_sviluppo", "rifiutata"],
};

export function canMoveTo(from: ProposalStatus, to: ProposalStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

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
