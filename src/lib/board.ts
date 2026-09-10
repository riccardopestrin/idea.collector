import type { ProposalListItem, ProposalStatus } from "@/lib/proposals";

// SSOT della board (ADR-0002). L'ordine del flusso diverge dall'enum DB:
// Archiviata va mostrata dopo Rifiutata.
export const BOARD_COLUMNS = [
  "nuova", "in_valutazione", "approvata", "in_sviluppo",
  "rilasciata", "rifiutata", "archiviata",
] as const satisfies readonly ProposalStatus[];

// Macchina a stati "ibrida" (#10): 'nuova' è la sola casella vincolata — da lì
// si esce solo verso 'in_valutazione' e non ci si rientra mai. Fra tutti gli
// altri stati il movimento è libero, per tutti i membri (l'accountability è la
// status_history). Gemella di move_proposal (migration 0031). Il blocco
// duplicati (RFC-006) è enforced a parte (updateProposalStatus + move_proposal).
export function canMoveTo(from: ProposalStatus, to: ProposalStatus): boolean {
  if (from === to || to === "nuova") return false;
  return from !== "nuova" || to === "in_valutazione";
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
