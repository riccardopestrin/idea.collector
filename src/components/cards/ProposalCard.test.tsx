import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import type { ProposalListItem } from "@/lib/proposals";

import { ProposalCard } from "./ProposalCard";

const base: ProposalListItem = {
  id: "1",
  title: "Mappa offline",
  description: "Serve la mappa senza rete",
  status: "nuova",
  created_at: "2026-01-01",
  proposer: { name: "Ada", email: "ada@hint.app" },
};

function renderCard(overrides: Partial<ProposalListItem> = {}) {
  render(<ProposalCard proposal={{ ...base, ...overrides }} />);
}

describe("ProposalCard", () => {
  it("shows title, status and description", () => {
    renderCard();
    expect(screen.getByText("Mappa offline")).toBeInTheDocument();
    expect(screen.getByText("nuova")).toBeInTheDocument();
    expect(screen.getByText("Serve la mappa senza rete")).toBeInTheDocument();
  });

  it("omits the description paragraph when there is none", () => {
    renderCard({ description: null });
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
});
