import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { NewProposalForm } from "./NewProposalForm";

const { createProposal } = vi.hoisted(() => ({ createProposal: vi.fn() }));
vi.mock("@/app/proposals/new/actions", () => ({ createProposal }));
// L'editor Tiptap è client-only (dynamic ssr:false) e non digita in jsdom:
// qui basta che il campo esponga name/label come un normale controllo form.
vi.mock("@/components/editor/RichTextField", () => ({
  RichTextField: ({ label, name }: { label: string; name: string }) => (
    <label>
      {label}
      <textarea name={name} />
    </label>
  ),
}));

describe("NewProposalForm", () => {
  beforeEach(() => {
    createProposal.mockReset().mockResolvedValue(null);
  });

  it("requires only the title and leaves the other fields optional", () => {
    render(<NewProposalForm projectId="pr1" />);

    expect(screen.getByLabelText(/titolo/i)).toBeRequired();
    expect(screen.getByLabelText(/descrizione/i)).not.toBeRequired();
    expect(screen.getByLabelText(/link/i)).not.toBeRequired();
    // un solo body: niente più campo "problema" in creazione
    expect(screen.queryByLabelText(/problema/i)).not.toBeInTheDocument();
  });

  it("shows the error the action returns", async () => {
    createProposal.mockResolvedValue({ error: "Errore nel salvataggio. Riprova." });
    const user = userEvent.setup();
    render(<NewProposalForm projectId="pr1" />);

    await user.type(screen.getByLabelText(/titolo/i), "Mappa offline");
    await user.click(screen.getByRole("button", { name: /crea proposta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore nel salvataggio");
  });

  it("submits the field values under the names the action parses", async () => {
    const user = userEvent.setup();
    render(<NewProposalForm projectId="pr1" />);

    await user.type(screen.getByLabelText(/titolo/i), "Mappa offline");
    await user.type(screen.getByLabelText(/link/i), "https://example.com");
    await user.click(screen.getByRole("button", { name: /crea proposta/i }));

    // un rename di un name= disallineerebbe form e parseProposalFields;
    // il primo argomento è il projectId legato via bind
    expect(createProposal.mock.calls[0][0]).toBe("pr1");
    const formData = createProposal.mock.calls[0][2] as FormData;
    expect(formData.get("title")).toBe("Mappa offline");
    expect(formData.get("links")).toBe("https://example.com");
    expect(formData.has("description")).toBe(true);
    // il body "problema" non è più nel form di creazione
    expect(formData.has("problem")).toBe(false);
  });
});
