import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeRiceScore,
  isProposalStatus,
  listProposals,
  type ProposalListItem,
  rankProposalsByScore,
  type ScoreFields,
} from "./proposals";

describe("isProposalStatus", () => {
  it("accepts a value from the DB enum", () => {
    expect(isProposalStatus("in_valutazione")).toBe(true);
  });

  it("rejects an unknown value", () => {
    expect(isProposalStatus("garbage")).toBe(false);
  });

  it("rejects undefined", () => {
    expect(isProposalStatus(undefined)).toBe(false);
  });
});

describe("computeRiceScore", () => {
  const fields = (overrides: Partial<ScoreFields>): ScoreFields => ({
    method: "rice",
    reach: 100,
    impact: 2,
    confidence: 0.5,
    effort: 4,
    ...overrides,
  });

  it("computes RICE as (reach × impact × confidence) / effort", () => {
    expect(computeRiceScore(fields({}))).toBe(25);
  });

  it("computes ICE as impact × confidence × effort (ease)", () => {
    expect(
      computeRiceScore(fields({ method: "ice", impact: 8, confidence: 7, effort: 6 })),
    ).toBe(336);
  });

  it("returns null when a component is missing", () => {
    expect(computeRiceScore(fields({ confidence: null }))).toBeNull();
  });

  it("returns null when RICE effort is zero (no division by zero)", () => {
    expect(computeRiceScore(fields({ effort: 0 }))).toBeNull();
  });
});

describe("rankProposalsByScore", () => {
  // Fabbrica di righe: id per identità, più i soli campi di scoring che contano.
  const item = (id: string, scores: Partial<ScoreFields>): ProposalListItem =>
    ({
      id,
      method: "rice",
      reach: null,
      impact: null,
      confidence: null,
      effort: null,
      ...scores,
    }) as ProposalListItem;

  const ids = (items: ProposalListItem[]) => items.map((p) => p.id);

  it("orders by composite score descending, mixing RICE and ICE", () => {
    const low = item("low", { reach: 10, impact: 1, confidence: 1, effort: 10 }); // RICE 1
    // ICE ignora reach nel calcolo, ma computeRiceScore lo pretende non-null.
    const high = item("high", { method: "ice", reach: 1, impact: 8, confidence: 7, effort: 6 }); // ICE 336
    const mid = item("mid", { reach: 100, impact: 2, confidence: 0.5, effort: 4 }); // RICE 25
    expect(ids(rankProposalsByScore([low, high, mid]))).toEqual(["high", "mid", "low"]);
  });

  it("pushes unscored proposals to the end", () => {
    const scored = item("scored", { reach: 100, impact: 2, confidence: 0.5, effort: 4 });
    const unscored = item("unscored", { confidence: null });
    expect(ids(rankProposalsByScore([unscored, scored]))).toEqual(["scored", "unscored"]);
  });

  it("preserves input order among all-unscored proposals", () => {
    const a = item("a", {});
    const b = item("b", {});
    expect(ids(rankProposalsByScore([a, b]))).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const input = [
      item("x", { reach: 10, impact: 1, confidence: 1, effort: 10 }),
      item("y", { reach: 100, impact: 2, confidence: 0.5, effort: 4 }),
    ];
    rankProposalsByScore(input);
    expect(ids(input)).toEqual(["x", "y"]);
  });
});

// Query builder finto: ogni metodo di filtro ritorna se stesso e registra le
// chiamate; overrideTypes chiude la catena risolvendo { data }.
function fakeBuilder(data: unknown) {
  const or = vi.fn();
  const eq = vi.fn();
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    or: or.mockImplementation(() => builder),
    eq: eq.mockImplementation(() => builder),
    overrideTypes: vi.fn(() => Promise.resolve({ data })),
  };
  const supabase = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
  return { supabase, or, eq };
}

describe("listProposals", () => {
  const row = {
    id: "1", title: "t", description: null, status: "nuova",
    created_at: "2026-01-01", proposer: null,
  };

  beforeEach(() => vi.clearAllMocks());

  it("searches title and description with a sanitized ilike term", async () => {
    const { supabase, or } = fakeBuilder([row]);

    await listProposals(supabase, { search: "map(a),b*" });

    // (, ), *, virgola diventano spazi per non rompere la grammatica .or
    expect(or).toHaveBeenCalledWith("title.ilike.%map a  b %,description.ilike.%map a  b %");
  });

  it("does not filter when no search or status is given", async () => {
    const { supabase, or, eq } = fakeBuilder([row]);

    await listProposals(supabase, {});

    expect(or).not.toHaveBeenCalled();
    expect(eq).not.toHaveBeenCalled();
  });

  it("filters by status when given", async () => {
    const { supabase, eq } = fakeBuilder([row]);

    await listProposals(supabase, { status: "approvata" });

    expect(eq).toHaveBeenCalledWith("status", "approvata");
  });

  it("returns an empty array when the query yields no data", async () => {
    const { supabase } = fakeBuilder(null);

    expect(await listProposals(supabase, {})).toEqual([]);
  });
});
