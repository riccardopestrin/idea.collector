import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateProposal } from "@/app/proposals/[id]/actions";

import { ProposalDiscussion } from "./ProposalDiscussion";

vi.mock("@/app/proposals/[id]/actions", () => ({ updateProposal: vi.fn() }));
vi.mock("@/app/proposals/actions", () => ({
  addComment: vi.fn(),
  deleteComment: vi.fn(),
  editComment: vi.fn(),
  requestCommentPromotion: vi.fn(),
  resolveCommentPromotion: vi.fn(),
  revokeCommentPromotion: vi.fn(),
}));
// Tiptap (dynamic, client-only) sostituito da una textarea: qui si testa il
// flusso edit, non l'editor.
vi.mock("@/components/editor/RichTextField", () => ({
  RichTextField: ({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string | null }) => (
    <label>
      {label}
      <textarea name={name} defaultValue={defaultValue ?? ""} />
    </label>
  ),
}));

const defaults = {
  title: "Dark mode",
  description: "Tema scuro",
  problem: null,
  links: ["https://example.com/spec"],
};

function renderDiscussion(canEdit: boolean) {
  return render(
    <ProposalDiscussion
      proposalId="p1"
      defaults={defaults}
      canEdit={canEdit}
      canComment
      comments={[]}
      currentUserId="u1"
      proposerId="u1"
      header={<h1>Dark mode</h1>}
    >
      <p>sezioni server</p>
    </ProposalDiscussion>,
  );
}

describe("ProposalDiscussion", () => {
  beforeEach(() => {
    vi.mocked(updateProposal).mockReset().mockResolvedValue(null);
  });

  it("renders header, text sections and server children in read mode without an edit button", () => {
    renderDiscussion(false);

    expect(screen.getByRole("heading", { name: "Dark mode" })).toBeInTheDocument();
    expect(screen.getByText("Tema scuro")).toBeInTheDocument();
    expect(screen.getByText("sezioni server")).toBeInTheDocument();
    expect(screen.queryByText("Problema / motivazione")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Modifica" })).not.toBeInTheDocument();
  });

  it("switches to the edit form prefilled with the current values and back on cancel", async () => {
    const user = userEvent.setup();
    renderDiscussion(true);

    await user.click(screen.getByRole("button", { name: "Modifica" }));
    expect(screen.getByLabelText("Titolo")).toHaveValue("Dark mode");
    expect(screen.getByLabelText("Descrizione")).toHaveValue("Tema scuro");
    expect(screen.getByLabelText("Link (uno per riga)")).toHaveValue("https://example.com/spec");
    expect(screen.queryByText("sezioni server")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Annulla" }));
    expect(screen.getByText("sezioni server")).toBeInTheDocument();
  });

  it("submits the edited fields to updateProposal and closes the form on success", async () => {
    const user = userEvent.setup();
    renderDiscussion(true);

    await user.click(screen.getByRole("button", { name: "Modifica" }));
    const title = screen.getByLabelText("Titolo");
    await user.clear(title);
    await user.type(title, "Dark mode v2");
    await user.click(screen.getByRole("button", { name: "Salva" }));

    const [id, , formData] = vi.mocked(updateProposal).mock.calls[0];
    expect(id).toBe("p1");
    expect(formData.get("title")).toBe("Dark mode v2");
    expect(formData.get("description")).toBe("Tema scuro");
    expect(await screen.findByText("sezioni server")).toBeInTheDocument();
  });

  it("keeps the form open and shows the error when the action fails", async () => {
    vi.mocked(updateProposal).mockResolvedValue({ error: "Il titolo è obbligatorio." });
    const user = userEvent.setup();
    renderDiscussion(true);

    // il titolo resta valido (required a livello HTML): l'errore arriva dall'action
    await user.click(screen.getByRole("button", { name: "Modifica" }));
    await user.click(screen.getByRole("button", { name: "Salva" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Il titolo è obbligatorio.");
    expect(screen.getByLabelText("Titolo")).toBeInTheDocument();
  });
});
