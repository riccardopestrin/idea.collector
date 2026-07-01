import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateProposalStatus } from "./actions";

// Builder finto per tabella: single() risolve la riga configurata; update/insert
// registrano le scritture. updateResult pilota l'esito di update().eq().
const { getUser, tables, refresh, updateResult } = vi.hoisted(() => {
  const updateResult = { value: { error: null } as { error: unknown } };
  const table = (row: unknown) => {
    const builder = {
      row,
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: builder.row })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(updateResult.value)) })),
      insert: vi.fn(() => Promise.resolve({ error: null })),
    };
    return builder;
  };
  return {
    getUser: vi.fn(),
    tables: { profiles: table(null), proposals: table(null), status_history: table(null) },
    refresh: vi.fn(),
    updateResult,
  };
});

vi.mock("@/lib/supabase/server", () => ({
  supabaseServer: async () => ({
    auth: { getUser },
    from: (name: keyof typeof tables) => tables[name],
  }),
}));
vi.mock("next/cache", () => ({ refresh }));

describe("updateProposalStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    tables.profiles.row = { role: "admin" };
    tables.proposals.row = { status: "nuova" };
    updateResult.value = { error: null };
  });

  it("rejects a value outside the status enum without touching the database", async () => {
    const result = await updateProposalStatus("p1", "garbage");
    expect(result).toEqual({ error: "Stato non valido." });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("refuses to write when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await updateProposalStatus("p1", "approvata");
    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("refuses a non-admin (contributor) even for own proposals", async () => {
    tables.profiles.row = { role: "contributor" };
    const result = await updateProposalStatus("p1", "approvata");
    expect(result).toEqual({ error: "Solo un admin può spostare le proposte." });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("reports a missing proposal without writing", async () => {
    tables.proposals.row = null;
    const result = await updateProposalStatus("p1", "approvata");
    expect(result).toEqual({ error: "Proposta non trovata." });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("updates the status and logs the transition in status_history", async () => {
    const result = await updateProposalStatus("p1", "approvata");

    expect(result).toBeNull();
    expect(tables.proposals.update).toHaveBeenCalledWith({ status: "approvata" });
    expect(tables.status_history.insert).toHaveBeenCalledWith({
      proposal_id: "p1",
      from_status: "nuova",
      to_status: "approvata",
      author_id: "u1",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("is a no-op when the proposal is already in the target status", async () => {
    tables.proposals.row = { status: "approvata" };
    const result = await updateProposalStatus("p1", "approvata");
    expect(result).toBeNull();
    expect(tables.proposals.update).not.toHaveBeenCalled();
    expect(tables.status_history.insert).not.toHaveBeenCalled();
  });

  it("returns an error and skips history when the update fails", async () => {
    updateResult.value = { error: { message: "boom" } };
    vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await updateProposalStatus("p1", "approvata");

    expect(result).toEqual({ error: "Errore nel salvataggio. Riprova." });
    expect(tables.status_history.insert).not.toHaveBeenCalled();
  });
});
