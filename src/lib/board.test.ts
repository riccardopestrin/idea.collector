import { describe, expect, it } from "vitest";

import type { ProposalListItem } from "@/lib/proposals";

import { BOARD_COLUMNS, groupByStatus, STATUS_LABELS } from "./board";

const proposal = (id: string, status: ProposalListItem["status"]): ProposalListItem => ({
  id,
  title: `p${id}`,
  description: null,
  status,
  created_at: "2026-01-01",
  proposer: null,
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

describe("STATUS_LABELS", () => {
  it("has a human label for every board column", () => {
    for (const status of BOARD_COLUMNS) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_LABELS[status]).not.toBe(status);
    }
  });
});
