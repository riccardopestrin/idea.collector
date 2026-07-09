import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addComment,
  deleteComment,
  deleteProposal,
  editComment,
  requestCommentPromotion,
  resolveCommentPromotion,
  revokeCommentPromotion,
  runProposalScanAction,
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

const runEvaluation = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/runEvaluation", () => ({ runEvaluation }));

const runProposalScan = vi.hoisted(() => vi.fn());
vi.mock("@/lib/ai/runProposalScan", () => ({ runProposalScan }));

beforeEach(() => {
  vi.clearAllMocks();
  getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  rpc.mockResolvedValue({ data: true, error: null });
  runEvaluation.mockResolvedValue(null);
  runProposalScan.mockResolvedValue(null);
  tables.profiles.row = { role: "contributor" };
  tables.proposals.row = {
    proposer_id: "u1",
    status: "nuova",
    description: "Una proposta con del testo utile.",
    problem: null,
    dup_flagged: false,
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

  it("re-runs the AI evaluation when an accepted contribution changes on a proposal in evaluation", async () => {
    tables.proposals.row = { proposer_id: "u2", status: "in_valutazione" };
    tables.comments.row = {
      author_id: "u1", proposal_id: "p1", body: "vecchio", promotion_status: "accepted",
    };
    const result = await editComment("c1", null, commentForm("nuovo testo"));
    expect(result).toBeNull();
    expect(runEvaluation).toHaveBeenCalledWith(expect.anything(), "p1", true);
  });

  it("does not re-run the evaluation when the accepted contribution text is unchanged", async () => {
    tables.proposals.row = { proposer_id: "u2", status: "in_valutazione" };
    tables.comments.row = {
      author_id: "u1", proposal_id: "p1", body: "stesso testo", promotion_status: "accepted",
    };
    await editComment("c1", null, commentForm("stesso testo"));
    expect(runEvaluation).not.toHaveBeenCalled();
  });

  it("does not re-run the evaluation when editing a normal comment", async () => {
    tables.proposals.row = { proposer_id: "u2", status: "in_valutazione" };
    tables.comments.row = {
      author_id: "u1", proposal_id: "p1", body: "vecchio", promotion_status: "none",
    };
    await editComment("c1", null, commentForm("nuovo testo"));
    expect(runEvaluation).not.toHaveBeenCalled();
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

  it("refuses to delete an accepted contribution before it is revoked", async () => {
    tables.comments.row = {
      author_id: "u1", proposal_id: "p1", promotion_status: "accepted",
    };
    const result = await deleteComment("c1");
    expect(result).toEqual({
      error: "Revoca la partecipazione prima di eliminare il contributo.",
    });
    expect(tables.comments.delete).not.toHaveBeenCalled();
  });

  it("returns a generic error when the delete fails", async () => {
    deleteResult.value = { error: { message: "boom" } };
    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = await deleteComment("c1");
    expect(result).toEqual({ error: "Errore nell'eliminazione. Riprova." });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("requestCommentPromotion", () => {
  beforeEach(() => {
    // commento di u1 su una proposta di u2, aperta
    tables.proposals.row = { proposer_id: "u2", status: "nuova" };
    tables.comments.row = {
      author_id: "u1", proposal_id: "p1", body: "idea", promotion_status: "none",
    };
  });

  it("refuses to promote when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await requestCommentPromotion("c1");
    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a user who is not the comment author", async () => {
    tables.comments.row = { ...tables.comments.row, author_id: "u3" };
    const result = await requestCommentPromotion("c1");
    expect(result).toEqual({ error: "Puoi proporre solo i tuoi commenti." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses the proposer's own comments", async () => {
    tables.proposals.row = { proposer_id: "u1", status: "nuova" };
    const result = await requestCommentPromotion("c1");
    expect(result).toEqual({
      error: "I tuoi commenti sulla tua proposta non sono promuovibili.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a promotion on a crystallized proposal", async () => {
    tables.proposals.row = { proposer_id: "u2", status: "approvata" };
    const result = await requestCommentPromotion("c1");
    expect(result).toEqual({ error: "La proposta non accetta più promozioni." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the RPC and refreshes, without re-running the evaluation", async () => {
    const result = await requestCommentPromotion("c1");
    expect(result).toBeNull();
    expect(rpc).toHaveBeenCalledWith("request_comment_promotion", { p_comment_id: "c1" });
    expect(refresh).toHaveBeenCalled();
    expect(runEvaluation).not.toHaveBeenCalled();
  });

  it("reports a stale state when the RPC compare-and-set fails", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await requestCommentPromotion("c1");
    expect(result).toEqual({
      error: "Lo stato del commento è cambiato nel frattempo. Ricarica la pagina.",
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("resolveCommentPromotion", () => {
  beforeEach(() => {
    // u1 è il proposer che decide sul commento pending di u2
    tables.proposals.row = { proposer_id: "u1", status: "in_valutazione" };
    tables.comments.row = {
      author_id: "u2", proposal_id: "p1", body: "idea", promotion_status: "pending",
    };
  });

  it("refuses a user who is neither proposer nor admin", async () => {
    tables.proposals.row = { ...tables.proposals.row, proposer_id: "u3" };
    const result = await resolveCommentPromotion("c1", true);
    expect(result).toEqual({ error: "Solo il proposer o un admin decide sulla promozione." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets an admin who is not the proposer decide", async () => {
    tables.proposals.row = { ...tables.proposals.row, proposer_id: "u3" };
    tables.profiles.row = { role: "admin" };
    const result = await resolveCommentPromotion("c1", true);
    expect(result).toBeNull();
    expect(rpc).toHaveBeenCalledWith("resolve_comment_promotion", {
      p_comment_id: "c1",
      p_accept: true,
    });
  });

  it("accepts and re-runs the evaluation when the proposal is in evaluation", async () => {
    const result = await resolveCommentPromotion("c1", true);
    expect(result).toBeNull();
    expect(refresh).toHaveBeenCalled();
    expect(runEvaluation).toHaveBeenCalledWith(expect.anything(), "p1", true);
  });

  it("accepts without re-running the evaluation when the proposal is still new", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "nuova" };
    const result = await resolveCommentPromotion("c1", true);
    expect(result).toBeNull();
    expect(runEvaluation).not.toHaveBeenCalled();
  });

  it("rejects without re-running the evaluation", async () => {
    const result = await resolveCommentPromotion("c1", false);
    expect(result).toBeNull();
    expect(rpc).toHaveBeenCalledWith("resolve_comment_promotion", {
      p_comment_id: "c1",
      p_accept: false,
    });
    expect(runEvaluation).not.toHaveBeenCalled();
  });

  it("reports a stale state when the RPC compare-and-set fails", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await resolveCommentPromotion("c1", true);
    expect(result).toEqual({
      error: "Lo stato del commento è cambiato nel frattempo. Ricarica la pagina.",
    });
    expect(runEvaluation).not.toHaveBeenCalled();
  });
});

describe("revokeCommentPromotion", () => {
  beforeEach(() => {
    // contributo accepted di u1 su proposta di u2, in valutazione
    tables.proposals.row = { proposer_id: "u2", status: "in_valutazione" };
    tables.comments.row = {
      author_id: "u1", proposal_id: "p1", body: "idea", promotion_status: "accepted",
    };
  });

  it("refuses a user who is neither author, proposer nor admin", async () => {
    tables.comments.row = { ...tables.comments.row, author_id: "u3" };
    const result = await revokeCommentPromotion("c1");
    expect(result).toEqual({
      error: "Solo l'autore, il proposer o un admin può revocare il contributo.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a revoke on a crystallized proposal", async () => {
    tables.proposals.row = { ...tables.proposals.row, status: "approvata" };
    const result = await revokeCommentPromotion("c1");
    expect(result).toEqual({ error: "La proposta non accetta più modifiche ai contributi." });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("lets the author revoke WITHOUT re-running the evaluation (decisione owner, 0016)", async () => {
    const result = await revokeCommentPromotion("c1");
    expect(result).toBeNull();
    expect(rpc).toHaveBeenCalledWith("revoke_comment_promotion", { p_comment_id: "c1" });
    expect(refresh).toHaveBeenCalled();
    expect(runEvaluation).not.toHaveBeenCalled();
  });

  it("re-runs the evaluation when the proposer revokes on a proposal in evaluation", async () => {
    tables.proposals.row = { proposer_id: "u1", status: "in_valutazione" };
    tables.comments.row = { ...tables.comments.row, author_id: "u2" };
    const result = await revokeCommentPromotion("c1");
    expect(result).toBeNull();
    expect(runEvaluation).toHaveBeenCalledWith(expect.anything(), "p1", true);
  });

  it("re-runs the evaluation when an admin revokes on a proposal in evaluation", async () => {
    tables.comments.row = { ...tables.comments.row, author_id: "u3" };
    tables.profiles.row = { role: "admin" };
    const result = await revokeCommentPromotion("c1");
    expect(result).toBeNull();
    expect(runEvaluation).toHaveBeenCalledWith(expect.anything(), "p1", true);
  });

  it("reports a stale state when the RPC compare-and-set fails", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await revokeCommentPromotion("c1");
    expect(result).toEqual({
      error: "Lo stato del commento è cambiato nel frattempo. Ricarica la pagina.",
    });
    expect(runEvaluation).not.toHaveBeenCalled();
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

  it("blocks a duplicate-flagged proposal from leaving 'nuova'", async () => {
    tables.proposals.row = { ...tables.proposals.row, dup_flagged: true };
    const result = await updateProposalStatus("p1", "nuova", "in_valutazione");
    expect(result).toEqual({
      error:
        "Possibile duplicato: modifica l'idea per differenziarla, oppure spostala in Rifiutata o eliminala.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still lets a duplicate-flagged proposal move to 'rifiutata'", async () => {
    tables.proposals.row = { ...tables.proposals.row, dup_flagged: true };
    const result = await updateProposalStatus("p1", "nuova", "rifiutata");
    expect(result).toBeNull();
    expect(rpc).toHaveBeenCalledWith("move_proposal", {
      p_id: "p1",
      p_from: "nuova",
      p_to: "rifiutata",
    });
  });

  it("blocks a flagged proposal from any source status (no rifiutata round-trip)", async () => {
    tables.proposals.row = { ...tables.proposals.row, dup_flagged: true };
    const result = await updateProposalStatus("p1", "rifiutata", "in_valutazione");
    expect(result).toEqual({
      error:
        "Possibile duplicato: modifica l'idea per differenziarla, oppure spostala in Rifiutata o eliminala.",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("still lets a flagged proposal move back to 'nuova' (unblock path)", async () => {
    tables.proposals.row = { ...tables.proposals.row, dup_flagged: true };
    const result = await updateProposalStatus("p1", "rifiutata", "nuova");
    expect(result).toBeNull();
    expect(rpc).toHaveBeenCalled();
  });
});

describe("runProposalScanAction", () => {
  it("refuses to run when there is no authenticated user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await runProposalScanAction("p1");
    expect(result).toEqual({ error: "Sessione scaduta. Rientra e riprova." });
    expect(runProposalScan).not.toHaveBeenCalled();
  });

  it("returns not-found when the proposal does not exist", async () => {
    tables.proposals.row = null;
    const result = await runProposalScanAction("p1");
    expect(result).toEqual({ error: "Proposta non trovata." });
    expect(runProposalScan).not.toHaveBeenCalled();
  });

  it("refuses a contributor who is not the author", async () => {
    tables.proposals.row = { ...tables.proposals.row, proposer_id: "someone-else" };
    const result = await runProposalScanAction("p1");
    expect(result).toEqual({
      error: "Solo l'autore o un admin può lanciare lo scan duplicati.",
    });
    expect(runProposalScan).not.toHaveBeenCalled();
  });

  it("lets the author run the scan and forwards the force flag", async () => {
    const result = await runProposalScanAction("p1", true);
    expect(result).toBeNull();
    expect(runProposalScan).toHaveBeenCalledWith(expect.anything(), "p1", true);
  });

  it("lets an admin run the scan on someone else's proposal", async () => {
    tables.proposals.row = { ...tables.proposals.row, proposer_id: "someone-else" };
    tables.profiles.row = { role: "admin" };
    const result = await runProposalScanAction("p1");
    expect(result).toBeNull();
    expect(runProposalScan).toHaveBeenCalledWith(expect.anything(), "p1", false);
  });

  it("surfaces the scan error to the caller", async () => {
    runProposalScan.mockResolvedValue({ error: "Scan duplicati fallito: boom" });
    const result = await runProposalScanAction("p1");
    expect(result).toEqual({ error: "Scan duplicati fallito: boom" });
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
