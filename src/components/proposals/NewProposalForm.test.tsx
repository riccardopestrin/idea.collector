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
    render(<NewProposalForm />);

    expect(screen.getByLabelText(/titolo/i)).toBeRequired();
    expect(screen.getByLabelText(/descrizione/i)).not.toBeRequired();
    expect(screen.getByLabelText(/problema/i)).not.toBeRequired();
    expect(screen.getByLabelText(/link/i)).not.toBeRequired();
  });

  it("shows the error the action returns", async () => {
    createProposal.mockResolvedValue({ error: "Errore nel salvataggio. Riprova." });
    const user = userEvent.setup();
    render(<NewProposalForm />);

    await user.type(screen.getByLabelText(/titolo/i), "Mappa offline");
    await user.click(screen.getByRole("button", { name: /crea proposta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore nel salvataggio");
  });
});
