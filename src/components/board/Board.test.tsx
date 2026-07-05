import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BOARD_COLUMNS, STATUS_LABELS } from "@/lib/board";
import type { ProposalListItem } from "@/lib/proposals";

import { Board } from "./Board";

const { updateProposalStatus, deleteProposal, evaluateProposal } = vi.hoisted(() => ({
  updateProposalStatus: vi.fn(async () => null),
  deleteProposal: vi.fn(async () => null),
  evaluateProposal: vi.fn(async () => null),
}));
vi.mock("@/app/proposals/actions", () => ({ updateProposalStatus, deleteProposal, evaluateProposal }));

const proposal = (
  id: string,
  status: ProposalListItem["status"],
  title: string,
  proposerId = "u1",
): ProposalListItem => ({
  id,
  title,
  description: null,
  status,
  method: "rice",
  reach: null,
  impact: null,
  confidence: null,
  effort: null,
  ai_eval_status: "assente",
  created_at: "2026-01-01",
  proposer_id: proposerId,
  proposer: null,
  votes: [],
});

describe("Board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one column per status, in flow order, with its label", () => {
    render(<Board proposals={[]} userId="u1" isAdmin={false} />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(
      BOARD_COLUMNS.map((s) => `${STATUS_LABELS[s]}0`),
    );
  });

  it("places each card in the column of its status and counts them", () => {
    render(
      <Board
        proposals={[
          proposal("1", "nuova", "Mappa offline"),
          proposal("2", "in_sviluppo", "Dark mode"),
          proposal("3", "nuova", "Export CSV"),
        ]}
        userId="u1"
        isAdmin={false}
      />,
    );

    const nuova = screen.getByRole("region", { name: "Nuova" });
    expect(within(nuova).getByText("Mappa offline")).toBeInTheDocument();
    expect(within(nuova).getByText("Export CSV")).toBeInTheDocument();
    expect(within(nuova).getByRole("heading")).toHaveTextContent("Nuova2");

    const inSviluppo = screen.getByRole("region", { name: "In Sviluppo" });
    expect(within(inSviluppo).getByText("Dark mode")).toBeInTheDocument();
    expect(within(inSviluppo).queryByText("Mappa offline")).not.toBeInTheDocument();
  });

  it("exposes every card as draggable, whoever the user is", () => {
    render(
      <Board
        proposals={[proposal("1", "nuova", "Mappa offline", "someone-else")]}
        userId="u1"
        isAdmin={false}
      />,
    );
    const li = screen.getByText("Mappa offline").closest("li");
    expect(li).toHaveAttribute("role", "button");
    expect(li).not.toHaveAttribute("aria-disabled", "true");
  });

  it("shows the delete button to a contributor only on their own proposals", () => {
    render(
      <Board
        proposals={[
          proposal("1", "nuova", "Mia", "u1"),
          proposal("2", "nuova", "Altrui", "u2"),
        ]}
        userId="u1"
        isAdmin={false}
      />,
    );
    expect(screen.getByRole("button", { name: "Elimina Mia" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Elimina Altrui" }),
    ).not.toBeInTheDocument();
  });

  it("shows the delete button to an admin on everyone's proposals", () => {
    render(
      <Board
        proposals={[proposal("2", "nuova", "Altrui", "u2")]}
        userId="u1"
        isAdmin
      />,
    );
    expect(screen.getByRole("button", { name: "Elimina Altrui" })).toBeInTheDocument();
  });

  it("asks for confirmation and deletes only after 'Elimina definitivamente'", async () => {
    const user = userEvent.setup();
    render(
      <Board proposals={[proposal("1", "nuova", "Mia", "u1")]} userId="u1" isAdmin={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Elimina Mia" }));
    expect(deleteProposal).not.toHaveBeenCalled();
    expect(screen.getByText("Eliminare “Mia”?")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Elimina definitivamente" }));
    expect(deleteProposal).toHaveBeenCalledWith("1");
  });

  it("offers 'Sposta in Rifiutata' as the conservative alternative", async () => {
    const user = userEvent.setup();
    render(
      <Board proposals={[proposal("1", "nuova", "Mia", "u1")]} userId="u1" isAdmin={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Elimina Mia" }));
    await user.click(screen.getByRole("button", { name: "Sposta in Rifiutata" }));

    expect(updateProposalStatus).toHaveBeenCalledWith("1", "nuova", "rifiutata");
    expect(deleteProposal).not.toHaveBeenCalled();
  });

  it("closes the dialog on 'Annulla' without touching the proposal", async () => {
    const user = userEvent.setup();
    render(
      <Board proposals={[proposal("1", "nuova", "Mia", "u1")]} userId="u1" isAdmin={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Elimina Mia" }));
    await user.click(screen.getByRole("button", { name: "Annulla" }));

    expect(screen.queryByText("Eliminare “Mia”?")).not.toBeInTheDocument();
    expect(deleteProposal).not.toHaveBeenCalled();
    expect(updateProposalStatus).not.toHaveBeenCalled();
  });
});
