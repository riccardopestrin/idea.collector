import type { ProposalListItem, ProposalStatus } from "@/lib/proposals";

// SSOT della board (ADR-0002). L'ordine del flusso diverge dall'enum DB:
// Archiviata va mostrata dopo Rifiutata.
export const BOARD_COLUMNS = [
  "nuova", "in_valutazione", "approvata", "in_sviluppo",
  "rilasciata", "rifiutata", "archiviata",
] as const satisfies readonly ProposalStatus[];

// #9: libertà assoluta di spostamento — ogni card va in qualsiasi altro stato
// (basta from !== to), per tutti gli utenti. Non c'è più una macchina a stati
// che vincola il drag; l'accountability resta la status_history. DELETE è a parte
// (azione trash, autore/admin, con conferma). Il blocco duplicati (RFC-006) è
// enforced fuori di qui (updateProposalStatus + move_proposal), non dal drag.

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
