"use client";

import { useEffect, useRef } from "react";

import { runProposalScanAction } from "@/app/proposals/actions";

// Trigger fire-and-forget dello scan anti-duplicato (RFC-006): reso dal
// pannello solo quando lo scan è 'assente' (e chi guarda è autorizzato a
// lanciarlo). L'esito arriva via dup_scan_status con il refresh dell'azione.
export function ProposalScanTrigger({ proposalId }: { proposalId: string }) {
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void runProposalScanAction(proposalId);
  }, [proposalId]);

  return null;
}
