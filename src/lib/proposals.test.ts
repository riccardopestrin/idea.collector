import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  computeClaudeScore,
  computeCompositeScore,
  computeVoteScore,
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

// Punteggio normalizzato di Claude: scale native RICE → 0–10.
// reach 100→0.5, impact 3→1, confidence 1→1, effort 3→0.5 ⇒ 10·0.5·1·1·(1−0.5)=2.5
const CLAUDE_25: ScoreFields = { method: "rice", reach: 100, impact: 3, confidence: 1, effort: 3 };

describe("computeClaudeScore", () => {
  it("normalizes Claude's native RICE scales to a 0–10 score", () => {
    expect(computeClaudeScore(CLAUDE_25)).toBeCloseTo(2.5);
  });

  it("returns null before Claude has scored", () => {
    expect(
      computeClaudeScore({ method: "rice", reach: null, impact: null, confidence: null, effort: null }),
    ).toBeNull();
  });
});

describe("computeVoteScore", () => {
  it("maps a max RICE vote (reach/impact/confidence 10, effort 1) to 10", () => {
    expect(computeVoteScore({ reach: 10, impact: 10, confidence: 10, effort: 1 }, "rice")).toBeCloseTo(10);
  });

  it("maps a min RICE vote to 0", () => {
    expect(computeVoteScore({ reach: 1, impact: 1, confidence: 1, effort: 1 }, "rice")).toBe(0);
  });

  it("treats ICE effort as ease (higher is better) and ignores reach", () => {
    expect(computeVoteScore({ reach: null, impact: 10, confidence: 10, effort: 10 }, "ice")).toBeCloseTo(10);
  });

  it("returns null when a required RICE component is missing", () => {
    expect(computeVoteScore({ reach: null, impact: 5, confidence: 5, effort: 5 }, "rice")).toBeNull();
  });
});

describe("computeCompositeScore", () => {
  const maxVote = { reach: 10, impact: 10, confidence: 10, effort: 1 }; // 10

  it("averages Claude and each user vote", () => {
    const c = computeCompositeScore(CLAUDE_25, [maxVote]);
    expect(c.claudeTotal).toBeCloseTo(2.5);
    expect(c.total).toBeCloseTo((2.5 + 10) / 2);
  });

  it("falls back to Claude only when there are no votes", () => {
    expect(computeCompositeScore(CLAUDE_25, []).total).toBeCloseTo(2.5);
  });

  it("uses user votes only when Claude has not scored", () => {
    const unscored: ScoreFields = { method: "rice", reach: null, impact: null, confidence: null, effort: null };
    const c = computeCompositeScore(unscored, [maxVote]);
    expect(c.claudeTotal).toBeNull();
    expect(c.total).toBeCloseTo(10);
  });

  it("averages each component (0–10) across Claude and users", () => {
    // reach: Claude 0.5→5, user slider 10→10 ⇒ media 7.5
    const c = computeCompositeScore(CLAUDE_25, [{ reach: 10, impact: 1, confidence: 1, effort: 1 }]);
    expect(c.components.reach).toBeCloseTo(7.5);
  });
});

describe("rankProposalsByScore", () => {
  // Fabbrica di righe: id per identità, più i soli campi di scoring che contano.
  // votes vuoto → il voto composito coincide col punteggio normalizzato di Claude.
  const item = (id: string, scores: Partial<ScoreFields>): ProposalListItem =>
    ({
      id,
      method: "rice",
      reach: null,
      impact: null,
      confidence: null,
      effort: null,
      votes: [],
      ...scores,
    }) as unknown as ProposalListItem;

  const ids = (items: ProposalListItem[]) => items.map((p) => p.id);

  it("orders by composite score descending, mixing RICE and ICE", () => {
    const low = item("low", { reach: 10, impact: 1, confidence: 1, effort: 10 }); // ~0.06
    // ICE ignora reach nel calcolo del voto normalizzato.
    const high = item("high", { method: "ice", reach: null, impact: 8, confidence: 7, effort: 6 }); // ~2.88
    const mid = item("mid", { reach: 100, impact: 2, confidence: 0.5, effort: 4 }); // ~0.68
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
