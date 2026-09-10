import { beforeEach, describe, expect, it, vi } from "vitest";

import { setGitRef, setTaskUrl, submitRiceVote, updateProposal } from "./actions";

const { getUser, tables, refresh, runEvaluation, runProposalScan, updateResult, insertResult } = vi.hoisted(() => {
  const updateResult = { value: { error: null } as { error: unknown } };
  const insertResult = { value: { error: null } as { error: unknown } };
  const table = (row: Record<string, unknown> | null) => {
    const builder = {
      row,
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      single: vi.fn(() => Promise.resolve({ data: builder.row })),
      maybeSingle: vi.fn(() => Promise.resolve({ data: builder.row })),
      update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(updateResult.value)) })),
      insert: vi.fn(() => Promise.resolve(insertResult.value)),
      upsert: vi.fn(() => Promise.resolve(insertResult.value)),
    };
    return builder;
  };
  return {
    getUser: vi.fn(),
    tables: {
      project_members: table(null),
      proposals: table(null),
      rice_votes: table(null),
      comments: table(null),
    },
    refresh: vi.fn(),
    runEvaluation: vi.fn(),
    runProposalScan: vi.fn(),
    updateResult,
    insertResult,
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
vi.mock("@/lib/ai/runProposalScan", () => ({ runProposalScan }));

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
  runProposalScan.mockResolvedValue(null);
  tables.project_members.row = { role: "contributor" };
  tables.proposals.row = {
    proposer_id: "u1",
    status: "nuova",
    title: "Titolo vecchio",
    description: "Descrizione vecchia",
    problem: null,
  };
  tables.comments.row = null;
  updateResult.value = { error: null };
  insertResult.value = { error: null };
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
    tables.project_members.row = { role: "admin" };
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
    expect(tables.proposals.update).toHaveBeenCalled();
  });

  it("lets the author edit past 'in_valutazione' and re-runs the AI evaluation (#10)", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "approvata" };
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
    expect(tables.proposals.update).toHaveBeenCalled();
    expect(runEvaluation).toHaveBeenCalledWith(expect.anything(), "p1", true);
  });

  it("does not re-run the AI evaluation while the proposal is 'nuova'", async () => {
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
    expect(runEvaluation).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("re-runs the duplicate scan on a text change in 'nuova'", async () => {
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
    expect(runProposalScan).toHaveBeenCalledWith(expect.anything(), "p1", true);
  });

  it("re-runs the AI evaluation on a text change in 'in_valutazione'", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "in_valutazione" };
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
    expect(runEvaluation).toHaveBeenCalledWith(expect.anything(), "p1", true);
    expect(runProposalScan).not.toHaveBeenCalled();
  });

  it("skips the AI re-runs when the text did not change", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "in_valutazione" };
    const unchanged = proposalForm({
      title: "Titolo vecchio",
      description: "Descrizione vecchia",
      problem: "",
    });
    expect(await updateProposal("p1", null, unchanged)).toBeNull();
    expect(runEvaluation).not.toHaveBeenCalled();
    expect(runProposalScan).not.toHaveBeenCalled();
  });

  it("does not fail the save when the evaluation fails", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "in_valutazione" };
    runEvaluation.mockResolvedValue({ error: "Errore nell'avvio della valutazione. Riprova." });
    expect(await updateProposal("p1", null, proposalForm())).toBeNull();
  });

  it("does not fail the save when the duplicate scan fails", async () => {
    runProposalScan.mockResolvedValue({ error: "Errore nell'avvio dello scan duplicati. Riprova." });
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

function voteForm(overrides: Record<string, string> = {}) {
  const form = new FormData();
  form.set("reach", "5");
  form.set("impact", "7");
  form.set("confidence", "6");
  form.set("effort", "3");
  Object.entries(overrides).forEach(([k, v]) => form.set(k, v));
  return form;
}

describe("submitRiceVote", () => {
  // votante diverso dal proposer (u1), proposta in valutazione: caso idoneo di base
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "u2" } } });
    tables.proposals.row = { proposer_id: "u1", status: "in_valutazione" };
  });

  it("refuses to write when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await submitRiceVote("p1", null, voteForm())).toEqual({
      error: "Sessione scaduta. Rientra e riprova.",
    });
    expect(tables.rice_votes.upsert).not.toHaveBeenCalled();
  });

  it("returns not-found when the proposal does not exist", async () => {
    tables.proposals.row = null;
    expect(await submitRiceVote("p1", null, voteForm())).toEqual({ error: "Proposta non trovata." });
    expect(tables.rice_votes.upsert).not.toHaveBeenCalled();
  });

  it("rejects a vote when the proposal is still in 'nuova'", async () => {
    tables.proposals.row = { proposer_id: "u1", status: "nuova" };
    expect(await submitRiceVote("p1", null, voteForm())).toEqual({
      error: "Non puoi votare una proposta in «Nuova».",
    });
    expect(tables.rice_votes.upsert).not.toHaveBeenCalled();
  });

  it("allows a vote in any state other than 'nuova' (#9c)", async () => {
    tables.proposals.row = { proposer_id: "u1", status: "approvata" };
    expect(await submitRiceVote("p1", null, voteForm())).toBeNull();
    expect(tables.rice_votes.upsert).toHaveBeenCalled();
  });

  it("forbids the proposer from voting their own idea", async () => {
    tables.proposals.row = { proposer_id: "u2", status: "in_valutazione" };
    expect(await submitRiceVote("p1", null, voteForm())).toEqual({
      error: "Non puoi votare la tua stessa proposta.",
    });
    expect(tables.rice_votes.upsert).not.toHaveBeenCalled();
  });

  it("forbids an accepted contributor (now a co-author) from voting", async () => {
    tables.comments.row = { id: "c1" };
    expect(await submitRiceVote("p1", null, voteForm())).toEqual({
      error: "Come contributore accettato sei co-autore: non puoi votare.",
    });
    expect(tables.rice_votes.upsert).not.toHaveBeenCalled();
    // il guard vale solo se la query filtra proprio su questi tre criteri:
    // senza promotion_status=accepted bloccherebbe qualsiasi commentatore
    expect(tables.comments.eq).toHaveBeenCalledWith("proposal_id", "p1");
    expect(tables.comments.eq).toHaveBeenCalledWith("author_id", "u2");
    expect(tables.comments.eq).toHaveBeenCalledWith("promotion_status", "accepted");
  });

  it("rejects an incomplete vote before hitting the database", async () => {
    expect(await submitRiceVote("p1", null, voteForm({ impact: "" }))).toEqual({
      error: "Assegna un valore da 1 a 10 a ogni parametro.",
    });
    expect(tables.rice_votes.upsert).not.toHaveBeenCalled();
  });

  it("upserts the vote on the (proposal, voter) key so it can be edited (#8)", async () => {
    expect(await submitRiceVote("p1", null, voteForm())).toBeNull();
    expect(tables.rice_votes.upsert).toHaveBeenCalledWith(
      { proposal_id: "p1", voter_id: "u2", reach: 5, impact: 7, confidence: 6, effort: 3 },
      { onConflict: "proposal_id,voter_id" },
    );
    expect(refresh).toHaveBeenCalled();
  });

  it("returns a generic error on an upsert failure", async () => {
    insertResult.value = { error: { code: "12345", message: "boom" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await submitRiceVote("p1", null, voteForm())).toEqual({
      error: "Errore nel salvataggio. Riprova.",
    });
  });
});

describe("setTaskUrl", () => {
  const form = (value: string) => {
    const fd = new FormData();
    fd.set("task_url", value);
    return fd;
  };

  it("rejects a non-ClickUp URL before touching the database", async () => {
    expect(await setTaskUrl("p1", null, form("https://evil.example/t/1"))).toEqual({
      error: "Link non valido: serve un URL https di app.clickup.com.",
    });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("refuses a user who is neither proposer nor admin", async () => {
    tables.proposals.row = { proposer_id: "someone-else" };
    expect(await setTaskUrl("p1", null, form("https://app.clickup.com/t/1"))).toEqual({
      error: "Solo l'autore o un admin può collegare un task.",
    });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("saves the task URL for the proposer and clears it on empty input", async () => {
    expect(await setTaskUrl("p1", null, form(" https://app.clickup.com/t/1 "))).toBeNull();
    expect(tables.proposals.update).toHaveBeenCalledWith({ task_url: "https://app.clickup.com/t/1" });

    expect(await setTaskUrl("p1", null, form(""))).toBeNull();
    expect(tables.proposals.update).toHaveBeenCalledWith({ task_url: null });
  });
});

describe("setGitRef", () => {
  const form = (value: string) => {
    const fd = new FormData();
    fd.set("git_ref", value);
    return fd;
  };

  it("rejects an invalid reference before touching the database", async () => {
    expect(await setGitRef("p1", null, form("two words"))).toEqual({
      error: "Riferimento non valido: niente spazi, max 200 caratteri.",
    });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("refuses a user who is neither proposer nor admin", async () => {
    tables.proposals.row = { proposer_id: "someone-else" };
    expect(await setGitRef("p1", null, form("feature/x"))).toEqual({
      error: "Solo l'autore o un admin può collegare branch o PR.",
    });
    expect(tables.proposals.update).not.toHaveBeenCalled();
  });

  it("saves a normalized PR reference for the proposer", async () => {
    expect(await setGitRef("p1", null, form("42"))).toBeNull();
    expect(tables.proposals.update).toHaveBeenCalledWith({ git_ref: "#42" });
    expect(refresh).toHaveBeenCalled();
  });

  it("lets an admin clear the reference with an empty input", async () => {
    tables.proposals.row = { proposer_id: "someone-else" };
    tables.project_members.row = { role: "admin" };
    expect(await setGitRef("p1", null, form(""))).toBeNull();
    expect(tables.proposals.update).toHaveBeenCalledWith({ git_ref: null });
  });
});
