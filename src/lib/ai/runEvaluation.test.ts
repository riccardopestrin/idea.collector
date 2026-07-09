import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runEvaluation } from "./runEvaluation";

const { refresh, evaluateWithClaude, buildRepoDigest, getGithubSettings } = vi.hoisted(() => ({
  refresh: vi.fn(),
  evaluateWithClaude: vi.fn(),
  buildRepoDigest: vi.fn(),
  getGithubSettings: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh }));
vi.mock("@/lib/ai/anthropic", () => ({ anthropicClient: () => ({}) }));
vi.mock("@/lib/ai/evaluateProposal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./evaluateProposal")>()),
  evaluateWithClaude,
}));
vi.mock("@/lib/github/repoDigest", () => ({ buildRepoDigest }));
vi.mock("@/lib/github/settings", () => ({ getGithubSettings }));

type Row = Record<string, unknown> | null;

// Supabase finto: from("proposals") è il load con l'embed dei contributi;
// rpc pilota begin/apply per esito.
function fakeSupabase({
  proposal,
  began = true,
  beginError = null,
  applyError = null,
}: {
  proposal: Row;
  began?: boolean;
  beginError?: { message: string } | null;
  applyError?: { message: string } | null;
}) {
  const rpc = vi.fn(async (name: string) => {
    if (name === "begin_ai_evaluation") return { data: began, error: beginError };
    if (name === "apply_ai_evaluation") return { data: null, error: applyError };
    return { data: null, error: null };
  });
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({
        eq: () => ({
          maybeSingle: () => ({ overrideTypes: async () => ({ data: proposal }) }),
        }),
      }),
    }),
  }));
  return { client: { from, rpc } as unknown as SupabaseClient, rpc };
}

const fresh = {
  title: "Mappa offline",
  description: "Serve senza rete",
  problem: null,
  links: [],
  ai_generated: false,
  manually_edited: false,
  contributions: [],
};

const scores = { reach: 5, impact: 6, confidence: 7, effort: 2, rationale: "Buona idea" };

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AI_EVAL_FAKE", "");
  getGithubSettings.mockResolvedValue({
    github_installation_id: 7,
    github_owner: "acme",
    github_repo: "ideas",
  });
  buildRepoDigest.mockResolvedValue("DIGEST");
  evaluateWithClaude.mockResolvedValue(scores);
});

describe("runEvaluation", () => {
  it("returns not-found when the proposal does not exist", async () => {
    const { client, rpc } = fakeSupabase({ proposal: null });
    expect(await runEvaluation(client, "p1")).toEqual({ error: "Proposta non trovata." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("skips the auto-trigger on an untouched AI evaluation, unless forced", async () => {
    const evaluated = { ...fresh, ai_generated: true, manually_edited: false };

    const first = fakeSupabase({ proposal: evaluated });
    expect(await runEvaluation(first.client, "p1")).toBeNull();
    expect(first.rpc).not.toHaveBeenCalled();

    const second = fakeSupabase({ proposal: evaluated });
    expect(await runEvaluation(second.client, "p1", true)).toBeNull();
    expect(second.rpc).toHaveBeenCalledWith("begin_ai_evaluation", {
      p_id: "p1",
      p_force: true,
    });
  });

  it("surfaces a begin error without touching the pipeline", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, rpc } = fakeSupabase({ proposal: fresh, beginError: { message: "boom" } });

    expect(await runEvaluation(client, "p1")).toEqual({
      error: "Errore nell'avvio della valutazione. Riprova.",
    });
    expect(rpc).not.toHaveBeenCalledWith("apply_ai_evaluation", expect.anything());
    expect(evaluateWithClaude).not.toHaveBeenCalled();
  });

  it("returns silently when an evaluation is already in flight", async () => {
    const { client, rpc } = fakeSupabase({ proposal: fresh, began: false });
    expect(await runEvaluation(client, "p1")).toBeNull();
    expect(rpc).not.toHaveBeenCalledWith("apply_ai_evaluation", expect.anything());
  });

  it("treats began=false under force as a vanished proposal", async () => {
    const { client } = fakeSupabase({ proposal: fresh, began: false });
    expect(await runEvaluation(client, "p1", true)).toEqual({ error: "Proposta non trovata." });
  });

  it("marks the evaluation failed when GitHub is not configured", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    getGithubSettings.mockResolvedValue(null);
    const { client, rpc } = fakeSupabase({ proposal: fresh });

    expect(await runEvaluation(client, "p1")).toEqual({
      error: "Valutazione fallita: Collega GitHub e scegli la repo nel profilo.",
    });
    expect(rpc).toHaveBeenCalledWith("fail_ai_evaluation", {
      p_id: "p1",
      p_error: "Collega GitHub e scegli la repo nel profilo.",
    });
    expect(rpc).not.toHaveBeenCalledWith("apply_ai_evaluation", expect.anything());
  });

  it("applies Claude's scores with the contributions sorted by date", async () => {
    const { client, rpc } = fakeSupabase({
      proposal: {
        ...fresh,
        contributions: [
          { body: "secondo", created_at: "2026-02-01", author: { name: "B" } },
          { body: "primo", created_at: "2026-01-01", author: null },
        ],
      },
    });

    expect(await runEvaluation(client, "p1")).toBeNull();

    expect(buildRepoDigest).toHaveBeenCalledWith(7, "acme", "ideas");
    expect(evaluateWithClaude).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "Mappa offline",
        contributions: [
          { author: null, body: "primo" },
          { author: "B", body: "secondo" },
        ],
      }),
      "DIGEST",
    );
    expect(rpc).toHaveBeenCalledWith("apply_ai_evaluation", {
      p_id: "p1",
      p_reach: 5,
      p_impact: 6,
      p_confidence: 7,
      p_effort: 2,
      p_rationale: "Buona idea",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("marks the evaluation failed when the apply RPC errors", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { client, rpc } = fakeSupabase({
      proposal: fresh,
      applyError: { message: "kaputt" },
    });

    expect(await runEvaluation(client, "p1")).toEqual({
      error: "Valutazione fallita: kaputt",
    });
    expect(rpc).toHaveBeenCalledWith("fail_ai_evaluation", { p_id: "p1", p_error: "kaputt" });
  });
});
