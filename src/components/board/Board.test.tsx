import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { BOARD_COLUMNS, STATUS_LABELS } from "@/lib/board";
import type { ProposalListItem } from "@/lib/proposals";

import { Board } from "./Board";

vi.mock("@/app/proposals/actions", () => ({
  updateProposalStatus: vi.fn(async () => null),
}));

const proposal = (
  id: string,
  status: ProposalListItem["status"],
  title: string,
): ProposalListItem => ({
  id,
  title,
  description: null,
  status,
  created_at: "2026-01-01",
  proposer: null,
});

describe("Board", () => {
  it("renders one column per status, in flow order, with its label", () => {
    render(<Board proposals={[]} canMove={false} />);

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
        canMove
      />,
    );

    const nuova = screen.getByRole("region", { name: "Nuovo" });
    expect(within(nuova).getByText("Mappa offline")).toBeInTheDocument();
    expect(within(nuova).getByText("Export CSV")).toBeInTheDocument();
    expect(within(nuova).getByRole("heading")).toHaveTextContent("Nuovo2");

    const inSviluppo = screen.getByRole("region", { name: "In Sviluppo" });
    expect(within(inSviluppo).getByText("Dark mode")).toBeInTheDocument();
    expect(within(inSviluppo).queryByText("Mappa offline")).not.toBeInTheDocument();
  });

  it("exposes cards as keyboard-draggable only when the user can move them", () => {
    const { rerender } = render(
      <Board proposals={[proposal("1", "nuova", "Mappa offline")]} canMove />,
    );
    expect(screen.getByText("Mappa offline").closest("li")).toHaveAttribute(
      "role",
      "button",
    );

    rerender(<Board proposals={[proposal("1", "nuova", "Mappa offline")]} canMove={false} />);
    expect(screen.getByText("Mappa offline").closest("li")).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });
});
