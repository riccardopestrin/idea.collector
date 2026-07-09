import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { STATUS_LABELS } from "@/lib/board";
import type { ProposalListItem } from "@/lib/proposals";

import { ProposalCard } from "./ProposalCard";

const base: ProposalListItem = {
  id: "1",
  title: "Mappa offline",
  description: "Serve la mappa senza rete",
  status: "nuova",
  reach: null,
  impact: null,
  confidence: null,
  effort: null,
  ai_eval_status: "assente",
  dup_scan_status: "assente",
  dup_flagged: false,
  created_at: "2026-01-01",
  proposer_id: "u1",
  proposer: { name: "Ada", email: "ada@hint.app" },
  votes: [],
  contributors: [],
};

function renderCard(
  overrides: Partial<ProposalListItem> = {},
  onDelete?: () => void,
  showStatus?: boolean,
) {
  render(
    <ProposalCard proposal={{ ...base, ...overrides }} onDelete={onDelete} showStatus={showStatus} />,
  );
}

describe("ProposalCard", () => {
  it("links the title to the proposal detail page", () => {
    renderCard();
    expect(screen.getByRole("link", { name: "Mappa offline" })).toHaveAttribute(
      "href",
      "/proposals/1",
    );
  });

  it("does not show the description in the card", () => {
    renderCard();
    expect(screen.queryByText("Serve la mappa senza rete")).not.toBeInTheDocument();
  });

  it("lists the accepted contributors as co-authors after the proposer", () => {
    renderCard({
      contributors: [
        { name: "Marco Rossi", email: "marco@hint.app" },
        { name: null, email: "bea@hint.app" },
      ],
    });
    expect(screen.getByText(/di Ada, Marco Rossi, bea@hint\.app/)).toBeInTheDocument();
  });

  it("prefers the proposer name", () => {
    renderCard();
    expect(screen.getByText(/di Ada/)).toBeInTheDocument();
  });

  it("falls back to the email when the name is missing", () => {
    renderCard({ proposer: { name: null, email: "ada@hint.app" } });
    expect(screen.getByText(/di ada@hint\.app/)).toBeInTheDocument();
  });

  it("falls back to 'sconosciuto' when there is no proposer", () => {
    renderCard({ proposer: null });
    expect(screen.getByText(/di sconosciuto/)).toBeInTheDocument();
  });

  it("renders the delete button only when onDelete is provided, and wires it", async () => {
    const onDelete = vi.fn();
    renderCard({}, onDelete);
    await userEvent.click(screen.getByRole("button", { name: "Elimina Mappa offline" }));
    expect(onDelete).toHaveBeenCalled();
  });

  it("has no delete button for who cannot delete", () => {
    renderCard();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the board status label when showStatus is set", () => {
    renderCard({ status: "in_valutazione" }, undefined, true);
    expect(screen.getByText(STATUS_LABELS.in_valutazione)).toBeInTheDocument();
  });

  it("hides the board status label by default", () => {
    renderCard({ status: "in_valutazione" });
    expect(screen.queryByText(STATUS_LABELS.in_valutazione)).not.toBeInTheDocument();
  });

  it("shows the duplicate badge only when the proposal is flagged", () => {
    renderCard({ dup_flagged: true });
    expect(screen.getByText("possibile duplicato")).toBeInTheDocument();
  });

  it("has no duplicate badge on an unflagged proposal", () => {
    renderCard();
    expect(screen.queryByText("possibile duplicato")).not.toBeInTheDocument();
  });
});
