import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteProposal, updateProposalStatus } from "./actions";

// Builder finto per tabella: single() risolve la riga configurata; update/insert/
// delete registrano le scritture. rpc pilota l'esito di move_proposal.
const { getUser, rpc, tables, refresh, deleteResult } = vi.hoisted(() => {
  const deleteResult = { value: { error: null } as { error: unknown } };
  const table = (row: unknown) => {
    const builder = {
      row,
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: builder.row })),
      delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(deleteResult.value)) })),
    };
    return builder;
  };
  return {
    getUser: vi.fn(),
    rpc: vi.fn(),
    tables: { profiles: table(null), proposals: table(null) },
    refresh: vi.fn(),
    deleteResult,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser },
    rpc,
    from: (name: keyof typeof tables) => tables[name],
  }),
}));
vi.mock("next/cache", () => ({ refresh }));

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  rpc.mockResolvedValue({ data: true, error: null });
  tables.profiles.row = { role: "contributor" };
  tables.proposals.row = { proposer_id: "u1" };
  deleteResult.value = { error: null };
});

describe("updateProposalStatus", () => {
  it("rejects a value outside the status enum without touching the database", async () => {
    const result = await updateProposalStatus("p1", "nuova", "garbage");
    expect(result).toEqual({ error: "Stato non valido." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a stale fromStatus outside the enum as well", async () => {
    const result = await updateProposalStatus("p1", "garbage", "approvata");
    expect(result).toEqual({ error: "Stato non valido." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("is a no-op when the proposal is already in the target status", async () => {
    const result = await updateProposalStatus("p1", "approvata", "approvata");
    expect(result).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses to write when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await updateProposalStatus("p1", "nuova", "approvata");
    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("moves via the move_proposal RPC as any authenticated member", async () => {
    const result = await updateProposalStatus("p1", "nuova", "approvata");
    expect(result).toBeNull();
    expect(rpc).toHaveBeenCalledWith("move_proposal", {
      p_id: "p1",
      p_from: "nuova",
      p_to: "approvata",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("reports a concurrent move when the compare-and-set finds no row", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await updateProposalStatus("p1", "nuova", "approvata");
    expect(result).toEqual({
      error: "La proposta è stata spostata da qualcun altro. Ricarica la pagina.",
    });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("returns a generic error when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await updateProposalStatus("p1", "nuova", "approvata");
    expect(result).toEqual({ error: "Errore nel salvataggio. Riprova." });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("deleteProposal", () => {
  it("refuses to delete when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await deleteProposal("p1");
    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(tables.proposals.delete).not.toHaveBeenCalled();
  });

  it("reports a missing proposal without deleting", async () => {
    tables.proposals.row = null;
    const result = await deleteProposal("p1");
    expect(result).toEqual({ error: "Proposta non trovata." });
    expect(tables.proposals.delete).not.toHaveBeenCalled();
  });

  it("refuses a contributor who is not the author", async () => {
    tables.proposals.row = { proposer_id: "someone-else" };
    const result = await deleteProposal("p1");
    expect(result).toEqual({
      error: "Solo l'autore o un admin può eliminare la proposta.",
    });
    expect(tables.proposals.delete).not.toHaveBeenCalled();
  });

  it("lets the author delete their own proposal", async () => {
    const result = await deleteProposal("p1");
    expect(result).toBeNull();
    expect(tables.proposals.delete).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("lets an admin delete someone else's proposal", async () => {
    tables.proposals.row = { proposer_id: "someone-else" };
    tables.profiles.row = { role: "admin" };
    const result = await deleteProposal("p1");
    expect(result).toBeNull();
    expect(tables.proposals.delete).toHaveBeenCalled();
  });

  it("returns a generic error when the delete fails", async () => {
    deleteResult.value = { error: { message: "boom" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deleteProposal("p1");
    expect(result).toEqual({ error: "Errore nell'eliminazione. Riprova." });
    expect(refresh).not.toHaveBeenCalled();
  });
});
