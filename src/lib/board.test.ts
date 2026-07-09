import { describe, expect, it } from "vitest";

import type { ProposalListItem } from "@/lib/proposals";

import { ALLOWED_TRANSITIONS, BOARD_COLUMNS, canMoveTo, groupByStatus, STATUS_LABELS } from "./board";

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

describe("STATUS_LABELS", () => {
  it("has a human label for every board column", () => {
    for (const status of BOARD_COLUMNS) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_LABELS[status]).not.toBe(status);
    }
  });
});

describe("canMoveTo", () => {
  it("allows exactly the transitions the state machine declares", () => {
    for (const from of BOARD_COLUMNS) {
      for (const to of BOARD_COLUMNS) {
        expect(canMoveTo(from, to)).toBe(ALLOWED_TRANSITIONS[from].includes(to));
      }
    }
  });

  it("allows the forward flow steps", () => {
    expect(canMoveTo("nuova", "in_valutazione")).toBe(true);
    expect(canMoveTo("in_valutazione", "approvata")).toBe(true);
    expect(canMoveTo("approvata", "in_sviluppo")).toBe(true);
    expect(canMoveTo("in_sviluppo", "rilasciata")).toBe(true);
  });

  it("lets every non-rejected state move to rifiutata", () => {
    for (const from of BOARD_COLUMNS) {
      if (from === "rifiutata") continue;
      expect(canMoveTo(from, "rifiutata")).toBe(true);
    }
  });

  it("makes rifiutata terminal — no transition leaves it (only DELETE)", () => {
    for (const to of BOARD_COLUMNS) expect(canMoveTo("rifiutata", to)).toBe(false);
  });

  it("forbids skipping forward and jumping into nuova", () => {
    expect(canMoveTo("nuova", "approvata")).toBe(false);
    expect(canMoveTo("nuova", "in_sviluppo")).toBe(false);
    expect(canMoveTo("in_valutazione", "in_sviluppo")).toBe(false);
    expect(canMoveTo("archiviata", "nuova")).toBe(false);
  });

  it("lets archiviata re-enter the active flow", () => {
    expect(canMoveTo("archiviata", "in_valutazione")).toBe(true);
    expect(canMoveTo("archiviata", "approvata")).toBe(true);
    expect(canMoveTo("archiviata", "in_sviluppo")).toBe(true);
  });
});
