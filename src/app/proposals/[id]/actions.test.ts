import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateProposal } from "./actions";

const { getUser, tables, refresh, runEvaluation, updateResult } = vi.hoisted(() => {
  const updateResult = { value: { error: null } as { error: unknown } };
  const table = (row: unknown) => {
    const builder = {
      row,
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: builder.row })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: builder.row })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(updateResult.value)) })),
    };
    return builder;
  };
  return {
    getUser: vi.fn(),
    tables: { profiles: table(null), proposals: table(null) },
    refresh: vi.fn(),
    runEvaluation: vi.fn(),
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
vi.mock("@/lib/ai/runEvaluation", () => ({ runEvaluation }));

function proposalForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("title", "Titolo nuovo");
  form.set("description", "Descrizione nuova");
  form.set("problem", "");
  form.set("links", "");
  Object.entries(overrides).forEach(([k, v]) => form.set(k, v));
  return form;
}

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  runEvaluation.mockResolvedValue(null);
  tables.profiles.row = { role: "contributor" };
  tables.proposals.row = {
    proposer_id: "u1",
    status: "nuova",
    title: "Titolo vecchio",
    description: "Descrizione vecchia",
    problem: null,
  };
  updateResult.value = { error: null };
});

describe("updateProposal", () => {
  it("refuses to write when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await updateProposal("p1", null, proposalForm());
    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("rejects a missing title", async () => {
    const result = await updateProposal("p1", null, proposalForm({ title: "  " }));
    expect(result).toEqual({ error: "Il titolo è obbligatorio." });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("refuses a contributor who is not the author", async () => {
    tables.proposals.row = { ...tables.proposals.row, proposer_id: "someone-else" };
    const result = await updateProposal("p1", null, proposalForm());
    expect(result).toEqual({
      error: "Solo l'autore o un admin può modificare la proposta.",
    });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("lets an admin edit someone else's proposal", async () => {
    tables.proposals.row = { ...tables.proposals.row, proposer_id: "someone-else" };
    tables.profiles.row = { role: "admin" };
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
    expect(tables.proposals.update).toHaveBeenCalled();
  });

  it("rejects the edit once the proposal is crystallized", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "approvata" };
    const result = await updateProposal("p1", null, proposalForm());
    expect(result).toEqual({ error: "La proposta non è più modificabile." });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("does not re-run the AI evaluation while the proposal is 'nuova'", async () => {
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
    expect(runEvaluation).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("re-runs the AI evaluation on a text change in 'in_valutazione'", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "in_valutazione" };
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
    expect(runEvaluation).toHaveBeenCalledWith(expect.anything(), "p1", true);
  });

  it("skips the AI evaluation when the text did not change", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "in_valutazione" };
    const unchanged = proposalForm({
      title: "Titolo vecchio",
      description: "Descrizione vecchia",
      problem: "",
    });
    expect(await updateProposal("p1", null, unchanged)).toBeNull();
    expect(runEvaluation).not.toHaveBeenCalled();
  });

  it("does not fail the save when the evaluation fails", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "in_valutazione" };
    runEvaluation.mockResolvedValue({ error: "Valutazione fallita: boom" });
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
  });

  it("returns a generic error when the update fails", async () => {
    updateResult.value = { error: { message: "boom" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await updateProposal("p1", null, proposalForm());
    expect(result).toEqual({ error: "Errore nel salvataggio. Riprova." });
    expect(runEvaluation).not.toHaveBeenCalled();
  });
});
