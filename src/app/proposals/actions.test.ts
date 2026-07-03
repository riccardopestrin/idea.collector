import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addComment,
  deleteComment,
  deleteProposal,
  editComment,
  updateProposalStatus,
} from "./actions";

// Builder finto per tabella: single() risolve la riga configurata; update/insert/
// delete registrano le scritture. rpc pilota l'esito di move_proposal.
const { getUser, rpc, tables, refresh, deleteResult, insertResult, updateResult } =
  vi.hoisted(() => {
    const deleteResult = { value: { error: null } as { error: unknown } };
    const insertResult = { value: { error: null } as { error: unknown } };
    const updateResult = { value: { error: null } as { error: unknown } };
    const table = (row: unknown) => {
      const builder = {
        row,
        select: vi.fn(() => builder),
        eq: vi.fn(() => builder),
        single: vi.fn(() => Promise.resolve({ data: builder.row })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: builder.row })),
        insert: vi.fn(() => Promise.resolve(insertResult.value)),
        update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(updateResult.value)) })),
        delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve(deleteResult.value)) })),
      };
      return builder;
    };
    return {
      getUser: vi.fn(),
      rpc: vi.fn(),
      tables: { profiles: table(null), proposals: table(null), comments: table(null) },
      refresh: vi.fn(),
      deleteResult,
      insertResult,
      updateResult,
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
  tables.proposals.row = {
    proposer_id: "u1",
    status: "nuova",
    description: "Una proposta con del testo utile.",
    problem: null,
  };
  tables.comments.row = { author_id: "u1", proposal_id: "p1" };
  deleteResult.value = { error: null };
  insertResult.value = { error: null };
  updateResult.value = { error: null };
});

function commentForm(body: string) {
  const form = new FormData();
  form.set("body", body);
  return form;
}

describe("addComment", () => {
  it("rejects an empty or whitespace-only body without touching the database", async () => {
    const result = await addComment("p1", null, commentForm("   "));
    expect(result).toEqual({ error: "Il commento non può essere vuoto." });
    expect(tables.comments.insert).not.toHaveBeenCalled();
  });

  it("rejects a body over 4000 characters", async () => {
    const result = await addComment("p1", null, commentForm("x".repeat(4001)));
    expect(result).toEqual({ error: "Commento troppo lungo (max 4000 caratteri)." });
    expect(tables.comments.insert).not.toHaveBeenCalled();
  });

  it("refuses to write when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await addComment("p1", null, commentForm("Ottima idea"));
    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(tables.comments.insert).not.toHaveBeenCalled();
  });

  it("inserts the trimmed comment in the caller's name and refreshes", async () => {
    const result = await addComment("p1", null, commentForm("  Ottima idea  "));
    expect(result).toBeNull();
    expect(tables.comments.insert).toHaveBeenCalledWith({
      proposal_id: "p1",
      author_id: "u1",
      body: "Ottima idea",
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("returns a generic error when the insert fails", async () => {
    insertResult.value = { error: { message: "boom" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await addComment("p1", null, commentForm("Ottima idea"));
    expect(result).toEqual({ error: "Errore nel salvataggio. Riprova." });
    expect(refresh).not.toHaveBeenCalled();
  });

  it("rejects a comment on a crystallized proposal", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "approvata" };
    const result = await addComment("p1", null, commentForm("Ottima idea"));
    expect(result).toEqual({ error: "La proposta non accetta più commenti." });
    expect(tables.comments.insert).not.toHaveBeenCalled();
  });

  it("inserts the anchor fields when the quote resolves in the current text", async () => {
    const form = commentForm("Concordo");
    form.set("anchor_field", "description");
    form.set("anchor_text", "testo utile");
    form.set("anchor_occurrence", "1");
    const result = await addComment("p1", null, form);
    expect(result).toBeNull();
    expect(tables.comments.insert).toHaveBeenCalledWith({
      proposal_id: "p1",
      author_id: "u1",
      body: "Concordo",
      anchor_field: "description",
      anchor_text: "testo utile",
      anchor_occurrence: 1,
    });
  });

  it("rejects an anchor whose quote no longer resolves", async () => {
    const form = commentForm("Concordo");
    form.set("anchor_field", "description");
    form.set("anchor_text", "testo sparito");
    form.set("anchor_occurrence", "1");
    const result = await addComment("p1", null, form);
    expect(result).toEqual({
      error: "Il testo selezionato non corrisponde più alla proposta. Ricarica la pagina.",
    });
    expect(tables.comments.insert).not.toHaveBeenCalled();
  });

  it("rejects a malformed anchor (bad field or occurrence)", async () => {
    const form = commentForm("Concordo");
    form.set("anchor_field", "internal_notes");
    form.set("anchor_text", "x");
    form.set("anchor_occurrence", "1");
    expect(await addComment("p1", null, form)).toEqual({
      error: "Ancora del commento non valida.",
    });

    const form2 = commentForm("Concordo");
    form2.set("anchor_field", "description");
    form2.set("anchor_text", "testo utile");
    form2.set("anchor_occurrence", "0");
    expect(await addComment("p1", null, form2)).toEqual({
      error: "Ancora del commento non valida.",
    });
    expect(tables.comments.insert).not.toHaveBeenCalled();
  });
});

describe("editComment", () => {
  it("rejects an empty body without touching the database", async () => {
    const result = await editComment("c1", null, commentForm("   "));
    expect(result).toEqual({ error: "Il commento non può essere vuoto." });
    expect(tables.comments.update).not.toHaveBeenCalled();
  });

  it("rejects a body over 4000 characters", async () => {
    const result = await editComment("c1", null, commentForm("x".repeat(4001)));
    expect(result).toEqual({ error: "Commento troppo lungo (max 4000 caratteri)." });
    expect(tables.comments.update).not.toHaveBeenCalled();
  });

  it("refuses to write when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await editComment("c1", null, commentForm("Nuovo testo"));
    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(tables.comments.update).not.toHaveBeenCalled();
  });

  it("reports a missing comment without updating", async () => {
    tables.comments.row = null;
    const result = await editComment("c1", null, commentForm("Nuovo testo"));
    expect(result).toEqual({ error: "Commento non trovato." });
    expect(tables.comments.update).not.toHaveBeenCalled();
  });

  it("refuses a user who is not the comment author", async () => {
    tables.comments.row = { author_id: "someone-else", proposal_id: "p1" };
    const result = await editComment("c1", null, commentForm("Nuovo testo"));
    expect(result).toEqual({ error: "Puoi modificare solo i tuoi commenti." });
    expect(tables.comments.update).not.toHaveBeenCalled();
  });

  it("refuses to edit a comment on a crystallized proposal", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "approvata" };
    const result = await editComment("c1", null, commentForm("Nuovo testo"));
    expect(result).toEqual({ error: "La proposta non accetta più modifiche." });
    expect(tables.comments.update).not.toHaveBeenCalled();
  });

  it("updates the trimmed body of the author's own comment and refreshes", async () => {
    const result = await editComment("c1", null, commentForm("  Testo corretto  "));
    expect(result).toBeNull();
    expect(tables.comments.update).toHaveBeenCalledWith({ body: "Testo corretto" });
    expect(refresh).toHaveBeenCalled();
  });

  it("returns a generic error when the update fails", async () => {
    updateResult.value = { error: { message: "boom" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await editComment("c1", null, commentForm("Testo corretto"));
    expect(result).toEqual({ error: "Errore nel salvataggio. Riprova." });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("deleteComment", () => {
  it("refuses to delete when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await deleteComment("c1");
    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(tables.comments.delete).not.toHaveBeenCalled();
  });

  it("reports a missing comment without deleting", async () => {
    tables.comments.row = null;
    const result = await deleteComment("c1");
    expect(result).toEqual({ error: "Commento non trovato." });
    expect(tables.comments.delete).not.toHaveBeenCalled();
  });

  it("refuses a user who is not the comment author", async () => {
    tables.comments.row = { author_id: "someone-else", proposal_id: "p1" };
    const result = await deleteComment("c1");
    expect(result).toEqual({ error: "Puoi eliminare solo i tuoi commenti." });
    expect(tables.comments.delete).not.toHaveBeenCalled();
  });

  it("refuses to delete a comment on a crystallized proposal", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "approvata" };
    const result = await deleteComment("c1");
    expect(result).toEqual({ error: "La proposta non accetta più modifiche." });
    expect(tables.comments.delete).not.toHaveBeenCalled();
  });

  it("lets the author delete their own comment and refreshes", async () => {
    const result = await deleteComment("c1");
    expect(result).toBeNull();
    expect(tables.comments.delete).toHaveBeenCalled();
    expect(refresh).toHaveBeenCalled();
  });

  it("returns a generic error when the delete fails", async () => {
    deleteResult.value = { error: { message: "boom" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deleteComment("c1");
    expect(result).toEqual({ error: "Errore nell'eliminazione. Riprova." });
    expect(refresh).not.toHaveBeenCalled();
  });
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
