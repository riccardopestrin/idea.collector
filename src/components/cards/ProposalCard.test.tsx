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
  method: "rice",
  reach: null,
  impact: null,
  confidence: null,
  effort: null,
  ai_eval_status: "assente",
  created_at: "2026-01-01",
  proposer_id: "u1",
  proposer: { name: "Ada", email: "ada@hint.app" },
  votes: [],
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
  it("shows the title", () => {
    renderCard();
    expect(screen.getByText("Mappa offline")).toBeInTheDocument();
  });

  it("does not show the description in the card", () => {
    renderCard();
    expect(screen.queryByText("Serve la mappa senza rete")).not.toBeInTheDocument();
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
});
