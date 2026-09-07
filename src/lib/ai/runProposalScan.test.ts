import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { runProposalScan } from "./runProposalScan";

const { refresh, findLocalDuplicate, searchCompetitors } = vi.hoisted(() => ({
  refresh: vi.fn(),
  findLocalDuplicate: vi.fn(),
  searchCompetitors: vi.fn(),
}));

vi.mock("next/cache", () => ({ refresh }));
// le scritture (RPC) passano dal client service-role (migration 0020): il mock
// delega alla rpc del fake corrente così i test asseriscono su una sola spy
const adminRpc = vi.hoisted(() => ({ current: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ rpc: (...args: unknown[]) => adminRpc.current(...args) }),
}));
vi.mock("@/lib/ai/anthropic", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./anthropic")>()),
  anthropicClient: () => ({}),
}));
vi.mock("@/lib/ai/scanProposal", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./scanProposal")>()),
  findLocalDuplicate,
  searchCompetitors,
}));

type Row = Record<string, unknown> | null;

// Supabase finto: la prima from("proposals") è il load della proposta, la
// seconda la query candidati (l'ordine è quello del service).
function fakeSupabase({
  proposal,
  candidates = [],
  candidatesError = null,
}: {
  proposal: Row;
  candidates?: Row[];
  candidatesError?: { message: string } | null;
}) {
  let call = 0;
  const from = vi.fn(() => {
    call += 1;
    if (call === 1) {
      return {
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: proposal }) }) }),
      };
    }
    return {
      select: () => ({
        // .eq("project_id") (0021) poi i due .neq: i candidati sono del progetto
        eq: () => ({
          neq: () => ({
            neq: () => ({
              order: () => ({
                limit: async () => ({ data: candidates, error: candidatesError }),
              }),
            }),
          }),
        }),
      }),
    };
  });
  const rpc = vi.fn(async () => ({ data: true, error: null }));
  adminRpc.current = rpc;
  return { client: { from, rpc } as unknown as SupabaseClient, rpc };
}

const inNuova = {
  title: "Idea",
  description: null,
  problem: null,
  status: "nuova",
  dup_scan_status: "assente",
};

beforeEach(() => {
  vi.clearAllMocks();
  findLocalDuplicate.mockResolvedValue({ matchId: null, similarity: 0, summary: "" });
  searchCompetitors.mockResolvedValue("Nessun riscontro sul web.");
});

describe("runProposalScan", () => {
  it("marks the scan failed when the candidates query errors (no false negative)", async () => {
    const { client, rpc } = fakeSupabase({
      proposal: inNuova,
      candidatesError: { message: "boom" },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await runProposalScan(client, "p1");

    expect(result).toEqual({ error: "Scan duplicati fallito: boom" });
    expect(rpc).toHaveBeenCalledWith("fail_dup_scan", { p_id: "p1", p_error: "boom" });
    expect(rpc).not.toHaveBeenCalledWith("apply_dup_scan", expect.anything());
  });

  it("flags the proposal at the 85 threshold with match, similarity and report", async () => {
    findLocalDuplicate.mockResolvedValue({
      matchId: "idea-1",
      similarity: 85,
      summary: "Molto simile.",
    });
    const { client, rpc } = fakeSupabase({ proposal: inNuova });

    expect(await runProposalScan(client, "p1")).toBeNull();
    expect(rpc).toHaveBeenCalledWith("apply_dup_scan", {
      p_id: "p1",
      p_flagged: true,
      p_similarity: 85,
      p_match: "idea-1",
      p_report: "Molto simile.\n\nNessun riscontro sul web.",
    });
  });

  it("does not flag below the threshold but keeps match and report", async () => {
    findLocalDuplicate.mockResolvedValue({
      matchId: "idea-1",
      similarity: 84,
      summary: "Tema affine.",
    });
    const { client, rpc } = fakeSupabase({ proposal: inNuova });

    await runProposalScan(client, "p1");
    expect(rpc).toHaveBeenCalledWith(
      "apply_dup_scan",
      expect.objectContaining({ p_flagged: false, p_similarity: 84, p_match: "idea-1" }),
    );
  });

  it("is a silent no-op outside 'nuova'", async () => {
    const { client, rpc } = fakeSupabase({
      proposal: { ...inNuova, status: "in_valutazione" },
    });
    expect(await runProposalScan(client, "p1")).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("skips the auto-trigger once a scan already ran, unless forced", async () => {
    const first = fakeSupabase({
      proposal: { ...inNuova, dup_scan_status: "completata" },
    });
    expect(await runProposalScan(first.client, "p1")).toBeNull();
    expect(first.rpc).not.toHaveBeenCalled();

    const second = fakeSupabase({
      proposal: { ...inNuova, dup_scan_status: "completata" },
    });
    expect(await runProposalScan(second.client, "p1", true)).toBeNull();
    expect(second.rpc).toHaveBeenCalledWith("begin_dup_scan", { p_id: "p1", p_force: true });
  });
});
