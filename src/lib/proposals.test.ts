import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeCompositeScore,
  computeVoteScore,
  isProposalStatus,
  listProposals,
  type ProposalListItem,
  rankProposalsByScore,
  type VoteComponents,
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

// RICE-10 (ADR-0006): media geometrica dei 4 fattori 1–10.
// (8·7·3·8)^(1/4) = 1344^(1/4) ≈ 6.055
const CLAUDE: VoteComponents = { reach: 8, impact: 7, confidence: 3, effort: 8 };

describe("computeVoteScore", () => {
  it("scores the geometric mean of the four 1–10 factors", () => {
    expect(computeVoteScore(CLAUDE)).toBeCloseTo(6.055);
  });

  it("collapses four equal factors to that value", () => {
    expect(computeVoteScore({ reach: 5, impact: 5, confidence: 5, effort: 5 })).toBeCloseTo(5);
  });

  it("maps a max vote (all 10) to 10", () => {
    expect(computeVoteScore({ reach: 10, impact: 10, confidence: 10, effort: 10 })).toBeCloseTo(10);
  });

  it("maps a min vote (all 1) to 1", () => {
    expect(computeVoteScore({ reach: 1, impact: 1, confidence: 1, effort: 1 })).toBe(1);
  });

  it("lets a weak factor sink the score (non-compensatory)", () => {
    // stessa idea di CLAUDE ma senza evidenze (confidence 1): crolla da ~6.05 a ~4.60
    const noEvidence = computeVoteScore({ ...CLAUDE, confidence: 1 });
    expect(noEvidence).toBeCloseTo(4.601);
    expect(noEvidence).toBeLessThan(computeVoteScore(CLAUDE)!);
  });

  it("returns null when a factor is missing", () => {
    expect(computeVoteScore({ reach: null, impact: 5, confidence: 5, effort: 5 })).toBeNull();
  });
});

describe("computeCompositeScore", () => {
  const maxVote = { reach: 10, impact: 10, confidence: 10, effort: 10 }; // 10

  it("averages Claude's and each user's individual score", () => {
    const c = computeCompositeScore(CLAUDE, [maxVote]);
    expect(c.claudeTotal).toBeCloseTo(6.055);
    expect(c.total).toBeCloseTo((6.055 + 10) / 2);
  });

  it("falls back to Claude only when there are no votes", () => {
    expect(computeCompositeScore(CLAUDE, []).total).toBeCloseTo(6.055);
  });

  it("uses user votes only when Claude has not scored", () => {
    const unscored: VoteComponents = { reach: null, impact: null, confidence: null, effort: null };
    const c = computeCompositeScore(unscored, [maxVote]);
    expect(c.claudeTotal).toBeNull();
    expect(c.total).toBeCloseTo(10);
  });

  it("averages each component (1–10) across Claude and users", () => {
    // reach: Claude 8, utente 10 ⇒ media 9
    const c = computeCompositeScore(CLAUDE, [maxVote]);
    expect(c.components.reach).toBeCloseTo(9);
  });
});

describe("rankProposalsByScore", () => {
  // Fabbrica di righe: id per identità, più i soli fattori di scoring che contano.
  // votes vuoto → il voto composito coincide col punteggio individuale di Claude.
  const item = (id: string, scores: Partial<VoteComponents>): ProposalListItem =>
    ({
      id,
      reach: null,
      impact: null,
      confidence: null,
      effort: null,
      votes: [],
      ...scores,
    }) as unknown as ProposalListItem;

  const ids = (items: ProposalListItem[]) => items.map((p) => p.id);

  it("orders by composite score descending", () => {
    const low = item("low", { reach: 2, impact: 2, confidence: 2, effort: 2 }); // 2
    const high = item("high", { reach: 8, impact: 8, confidence: 8, effort: 8 }); // 8
    const mid = item("mid", { reach: 5, impact: 5, confidence: 5, effort: 5 }); // 5
    expect(ids(rankProposalsByScore([low, high, mid]))).toEqual(["high", "mid", "low"]);
  });

  it("pushes unscored proposals to the end", () => {
    const scored = item("scored", { reach: 5, impact: 5, confidence: 5, effort: 5 });
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
      item("x", { reach: 2, impact: 2, confidence: 2, effort: 2 }),
      item("y", { reach: 8, impact: 8, confidence: 8, effort: 8 }),
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
