import { describe, expect, it } from "vitest";

import type { ProposalListItem } from "@/lib/proposals";

import { STRINGS } from "@/lib/strings";

import { BOARD_COLUMNS, groupByStatus } from "./board";

const proposal = (id: string, status: ProposalListItem["status"]): ProposalListItem => ({
  id,
  contributors: [],
  title: `p${id}`,
  description: null,
  status,
  reach: null,
  impact: null,
  confidence: null,
  effort: null,
  ai_eval_status: "assente",
  dup_scan_status: "assente",
  dup_flagged: false,
  created_at: "2026-01-01",
  proposer_id: "u1",
  proposer: null,
  votes: [],
});

describe("groupByStatus", () => {
  it("groups each proposal under its status column", () => {
    const groups = groupByStatus([
      proposal("1", "nuova"),
      proposal("2", "approvata"),
      proposal("3", "nuova"),
    ]);

    expect(groups.nuova.map((p) => p.id)).toEqual(["1", "3"]);
    expect(groups.approvata.map((p) => p.id)).toEqual(["2"]);
  });

  it("returns an empty array for every column with no proposals", () => {
    const groups = groupByStatus([]);
    for (const status of BOARD_COLUMNS) expect(groups[status]).toEqual([]);
  });

  it("preserves the incoming order inside a column", () => {
    const groups = groupByStatus([proposal("b", "rifiutata"), proposal("a", "rifiutata")]);
    expect(groups.rifiutata.map((p) => p.id)).toEqual(["b", "a"]);
  });
});

describe("STRINGS.status", () => {
  // label pinnate per intero: un typo o uno swap (es. Approvata↔Rifiutata)
  // cambierebbe cosa vede l'utente in board senza rompere nessun tipo
  it("maps every status to its exact human label", () => {
    expect(STRINGS.status).toEqual({
      nuova: "Nuova",
      in_valutazione: "In Valutazione",
      approvata: "Approvata",
      in_sviluppo: "In Sviluppo",
      rilasciata: "Rilasciata",
      rifiutata: "Rifiutata",
      archiviata: "Archiviata",
    });
  });
});

