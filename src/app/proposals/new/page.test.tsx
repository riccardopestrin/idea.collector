import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import NewProposalPage from "./page";

const { createProposal } = vi.hoisted(() => ({ createProposal: vi.fn() }));
vi.mock("./actions", () => ({ createProposal }));

describe("NewProposalPage", () => {
  beforeEach(() => {
    createProposal.mockReset().mockResolvedValue(null);
  });

  it("requires only the title and leaves the other fields optional", () => {
    render(<NewProposalPage />);

    expect(screen.getByLabelText(/titolo/i)).toBeRequired();
    expect(screen.getByLabelText(/descrizione/i)).not.toBeRequired();
    expect(screen.getByLabelText(/problema/i)).not.toBeRequired();
    expect(screen.getByLabelText(/link/i)).not.toBeRequired();
  });

  it("shows the error the action returns", async () => {
    createProposal.mockResolvedValue({ error: "Errore nel salvataggio. Riprova." });
    const user = userEvent.setup();
    render(<NewProposalPage />);

    await user.type(screen.getByLabelText(/titolo/i), "Mappa offline");
    await user.click(screen.getByRole("button", { name: /crea proposta/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Errore nel salvataggio");
  });
});
