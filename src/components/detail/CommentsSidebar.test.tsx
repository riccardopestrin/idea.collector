import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  addComment,
  deleteComment,
  editComment,
  requestCommentPromotion,
  resolveCommentPromotion,
  revokeCommentPromotion,
} from "@/app/proposals/actions";
import type { ProposalComment } from "@/lib/proposals";

import { CommentsSidebar } from "./CommentsSidebar";

vi.mock("@/app/proposals/actions", () => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  editComment: vi.fn(),
  requestCommentPromotion: vi.fn(),
  resolveCommentPromotion: vi.fn(),
  revokeCommentPromotion: vi.fn(),
}));

// c1 di Gino (u2) sulla proposta di Fina (u1); u3 è un terzo membro
const comment: ProposalComment = {
  id: "c1",
  body: "Serve anche sul mobile",
  created_at: "2026-07-02T10:00:00Z",
  author_id: "u2",
  author: { name: "Gino", email: "gino@hint.app" },
  promotion_status: "none",
  anchor_field: null,
  anchor_text: null,
  anchor_occurrence: null,
  anchor_resolved: false,
};

function renderSidebar(
  props: Partial<Parameters<typeof CommentsSidebar>[0]> & { comments?: ProposalComment[] } = {},
) {
  return render(
    <CommentsSidebar
      proposalId="p1"
      comments={[comment]}
      currentUserId="u3"
      proposerId="u1"
      pendingAnchor={null}
      onCancelAnchor={() => {}}
      onHoverComment={() => {}}
      {...props}
    />,
  );
}

const buttons = () => screen.queryAllByRole("button").map((b) => b.textContent);

describe("CommentsSidebar", () => {
  beforeEach(() => {
    for (const fn of [
      addComment,
      deleteComment,
      editComment,
      requestCommentPromotion,
      resolveCommentPromotion,
      revokeCommentPromotion,
    ]) {
      vi.mocked(fn).mockReset().mockResolvedValue(null);
    }
  });

  it("shows no per-comment controls to a third member, and the propose button to the author", () => {
    const { rerender } = renderSidebar();
    expect(buttons()).toEqual(["Commenta"]);

    rerender(
      <CommentsSidebar
        proposalId="p1"
        comments={[comment]}
        currentUserId="u2"
        proposerId="u1"
        pendingAnchor={null}
        onCancelAnchor={() => {}}
        onHoverComment={() => {}}
      />,
    );
    expect(buttons()).toEqual(["Modifica", "Elimina", "Proponi come contributo", "Commenta"]);
  });

  it("lets an admin delete but not edit or propose someone else's comment", () => {
    renderSidebar({ isAdmin: true });
    expect(buttons()).toEqual(["Elimina", "Commenta"]);
  });

  it("deletes only after the confirm step", async () => {
    const user = userEvent.setup();
    renderSidebar({ currentUserId: "u2" });

    await user.click(screen.getByRole("button", { name: "Elimina" }));
    expect(deleteComment).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.queryByRole("button", { name: "Conferma eliminazione" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Elimina" }));
    await user.click(screen.getByRole("button", { name: "Conferma eliminazione" }));
    expect(deleteComment).toHaveBeenCalledWith("c1");
  });

  it("edits inline and submits the new body to the action", async () => {
    const user = userEvent.setup();
    renderSidebar({ currentUserId: "u2" });

    await user.click(screen.getByRole("button", { name: "Modifica" }));
    const field = screen.getByLabelText("Modifica commento");
    expect(field).toHaveValue("Serve anche sul mobile");
    await user.clear(field);
    await user.type(field, "Testo corretto");
    await user.click(screen.getByRole("button", { name: "Salva" }));

    expect(vi.mocked(editComment).mock.calls[0][0]).toBe("c1");
    expect(vi.mocked(editComment).mock.calls[0][2].get("body")).toBe("Testo corretto");
  });

  it("the author proposes, the proposer accepts or rejects a pending one", async () => {
    const user = userEvent.setup();
    const { rerender } = renderSidebar({ currentUserId: "u2" });

    await user.click(screen.getByRole("button", { name: "Proponi come contributo" }));
    expect(requestCommentPromotion).toHaveBeenCalledWith("c1");

    rerender(
      <CommentsSidebar
        proposalId="p1"
        comments={[{ ...comment, promotion_status: "pending" }]}
        currentUserId="u1"
        proposerId="u1"
        pendingAnchor={null}
        onCancelAnchor={() => {}}
        onHoverComment={() => {}}
      />,
    );
    expect(screen.getByText("candidato contributo")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Accetta" }));
    expect(resolveCommentPromotion).toHaveBeenCalledWith("c1", true);
    await user.click(screen.getByRole("button", { name: "Rifiuta" }));
    expect(resolveCommentPromotion).toHaveBeenCalledWith("c1", false);
  });

  it("an accepted contribution can be revoked but not deleted, and shows the action error", async () => {
    vi.mocked(revokeCommentPromotion).mockResolvedValue({
      error: "Lo stato del commento è cambiato nel frattempo. Ricarica la pagina.",
    });
    const user = userEvent.setup();
    renderSidebar({ comments: [{ ...comment, promotion_status: "accepted" }], currentUserId: "u2" });

    expect(screen.getByText("contributo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elimina" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Revoca partecipazione" }));
    expect(revokeCommentPromotion).toHaveBeenCalledWith("c1");
    expect(await screen.findByRole("alert")).toHaveTextContent("Ricarica la pagina");
  });

  it("flags a stale anchor and highlights the hovered comment", async () => {
    const onHover = vi.fn();
    const user = userEvent.setup();
    renderSidebar({
      comments: [{ ...comment, anchor_field: "description", anchor_text: "vecchio testo", anchor_occurrence: 1 }],
      onHoverComment: onHover,
    });

    const item = screen.getByText("vecchio testo").closest("li")!;
    expect(within(item).getByText("testo modificato")).toBeInTheDocument();
    await user.hover(item);
    expect(onHover).toHaveBeenCalledWith("c1");
    await user.unhover(item);
    expect(onHover).toHaveBeenCalledWith(null);
  });

  it("in anchored mode the form quotes the selection, sends the anchor fields and can cancel", async () => {
    const onCancel = vi.fn();
    const user = userEvent.setup();
    renderSidebar({
      pendingAnchor: { field: "description", quote: "vista di notte", occurrence: 2 },
      onCancelAnchor: onCancel,
    });

    expect(screen.getByText("vista di notte")).toBeInTheDocument();
    await user.type(screen.getByLabelText("Commenta la selezione"), "Concordo");
    await user.click(screen.getByRole("button", { name: "Commenta" }));

    const formData = vi.mocked(addComment).mock.calls[0][2];
    expect(formData.get("body")).toBe("Concordo");
    expect(formData.get("anchor_field")).toBe("description");
    expect(formData.get("anchor_text")).toBe("vista di notte");
    expect(formData.get("anchor_occurrence")).toBe("2");
    // a commento salvato la modalità ancorata si chiude
    expect(onCancel).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});
