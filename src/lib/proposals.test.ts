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
  const neq = vi.fn();
  const builder = {
    select: vi.fn(() => builder),
    order: vi.fn(() => builder),
    or: or.mockImplementation(() => builder),
    eq: eq.mockImplementation(() => builder),
    neq: neq.mockImplementation(() => builder),
    overrideTypes: vi.fn(() => Promise.resolve({ data })),
  };
  const supabase = { from: vi.fn(() => builder) } as unknown as SupabaseClient;
  return { supabase, or, eq, neq };
}

describe("listProposals", () => {
  const row = {
    id: "1", title: "t", description: null, status: "nuova",
    created_at: "2026-01-01", proposer: null, votes: [], contributors: [],
  };

  beforeEach(() => vi.clearAllMocks());

  it("searches title and description with a sanitized ilike term", async () => {
    const { supabase, or } = fakeBuilder([row]);

    await listProposals(supabase, { projectId: "pr1", search: "map(a),b*" });

    // (, ), *, virgola diventano spazi per non rompere la grammatica .or
    expect(or).toHaveBeenCalledWith("title.ilike.%map a  b %,description.ilike.%map a  b %");
  });

  it("keeps archived proposals out of search results", async () => {
    const { supabase, neq } = fakeBuilder([row]);

    await listProposals(supabase, { projectId: "pr1", search: "mappa" });

    expect(neq).toHaveBeenCalledWith("status", "archiviata");
  });

  it("searches inside the archive when the status filter asks for it", async () => {
    const { supabase, neq, eq } = fakeBuilder([row]);

    await listProposals(supabase, { projectId: "pr1", search: "mappa", status: "archiviata" });

    expect(neq).not.toHaveBeenCalled();
    expect(eq).toHaveBeenCalledWith("status", "archiviata");
  });

  it("scopes to the project and does not filter further when no search or status is given", async () => {
    const { supabase, or, eq, neq } = fakeBuilder([row]);

    await listProposals(supabase, { projectId: "pr1" });

    expect(or).not.toHaveBeenCalled();
    expect(neq).not.toHaveBeenCalled();
    // solo il filtro sull'embed dei contributi (0016) e quello di progetto (0021)
    expect(eq).toHaveBeenCalledTimes(2);
    expect(eq).toHaveBeenCalledWith("contributors.promotion_status", "accepted");
    expect(eq).toHaveBeenCalledWith("project_id", "pr1");
  });

  it("filters by status when given", async () => {
    const { supabase, eq } = fakeBuilder([row]);

    await listProposals(supabase, { projectId: "pr1", status: "approvata" });

    expect(eq).toHaveBeenCalledWith("status", "approvata");
  });

  it("returns an empty array when the query yields no data", async () => {
    const { supabase } = fakeBuilder(null);

    expect(await listProposals(supabase, { projectId: "pr1" })).toEqual([]);
  });

  it("suspends the votes of accepted contributors and keeps the others", async () => {
    const { supabase } = fakeBuilder([{
      ...row,
      votes: [
        { voter_id: "u2", reach: 5, impact: 5, confidence: 5, effort: 5 },
        { voter_id: "u3", reach: 8, impact: 8, confidence: 8, effort: 8 },
      ],
      contributors: [{
        author_id: "u2", promotion_status: "accepted",
        created_at: "2026-01-02", author: { name: "Ada", email: "ada@hint.app" },
      }],
    }]);

    const [item] = await listProposals(supabase, { projectId: "pr1" });
    // il voto del contributore u2 è sospeso (derivato, la riga a DB resta)
    expect(item.votes).toEqual([
      { voter_id: "u3", reach: 8, impact: 8, confidence: 8, effort: 8 },
    ]);
  });

  it("dedupes co-authors with multiple accepted contributions, ordered by first contribution", async () => {
    const ada = { name: "Ada", email: "ada@hint.app" };
    const bea = { name: "Bea", email: "bea@hint.app" };
    const { supabase } = fakeBuilder([{
      ...row,
      contributors: [
        { author_id: "u3", promotion_status: "accepted", created_at: "2026-01-05", author: bea },
        { author_id: "u2", promotion_status: "accepted", created_at: "2026-01-02", author: ada },
        { author_id: "u2", promotion_status: "accepted", created_at: "2026-01-03", author: ada },
      ],
    }]);

    const [item] = await listProposals(supabase, { projectId: "pr1" });
    expect(item.contributors).toEqual([ada, bea]);
  });
});
