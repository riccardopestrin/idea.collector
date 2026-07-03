import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProposalDetail } from "@/lib/proposals";

import { ProposalPanel } from "./ProposalPanel";

// Le server action sono irrilevanti qui: i flussi sono testati via action test.
vi.mock("@/app/proposals/actions", () => ({
  addComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
}));

const base: ProposalDetail = {
  id: "p1",
  title: "Dark mode",
  description: "Tema scuro per la dashboard",
  problem: "Affatica la vista di notte",
  status: "in_valutazione",
  method: "rice",
  reach: null,
  impact: null,
  confidence: null,
  effort: null,
  ai_rationale: null,
  ai_eval_status: "assente",
  ai_eval_error: null,
  links: ["https://example.com/spec"],
  internal_notes: null,
  created_at: "2026-07-01T10:00:00Z",
  proposer_id: "u1",
  proposer: { name: "Fina", email: "fina@test.local" },
  status_history: [
    {
      id: "h1",
      from_status: "nuova",
      to_status: "in_valutazione",
      created_at: "2026-07-02T09:00:00Z",
      author: { name: null, email: "gino@test.local" },
    },
  ],
  comments: [
    {
      id: "c1",
      body: "Serve anche sul mobile",
      created_at: "2026-07-02T10:00:00Z",
      author_id: "u2",
      author: { name: "Gino", email: "gino@test.local" },
      anchor_field: null,
      anchor_text: null,
      anchor_occurrence: null,
      anchor_resolved: false,
    },
  ],
};

describe("ProposalPanel", () => {
  it("shows title, status label, author and the main text sections", () => {
    render(<ProposalPanel detail={base} />);
    expect(screen.getByRole("heading", { name: "Dark mode" })).toBeInTheDocument();
    expect(screen.getByText(/In Valutazione · di Fina/)).toBeInTheDocument();
    expect(screen.getByText("Tema scuro per la dashboard")).toBeInTheDocument();
    expect(screen.getByText("Affatica la vista di notte")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "https://example.com/spec" }),
    ).toHaveAttribute("href", "https://example.com/spec");
  });

  it("renders a non-http link as inert text, never as an anchor", () => {
    render(
      <ProposalPanel detail={{ ...base, links: ["javascript:alert(1)"] }} />,
    );
    expect(screen.getByText("javascript:alert(1)")).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "javascript:alert(1)" }),
    ).not.toBeInTheDocument();
  });

  it("renders the status history with transition, author and hides the score section when unscored", () => {
    render(<ProposalPanel detail={base} />);
    expect(screen.getByText(/Nuova → In Valutazione/)).toBeInTheDocument();
    expect(screen.getByText(/gino@test\.local/)).toBeInTheDocument();
    expect(screen.queryByText(/Punteggio/)).not.toBeInTheDocument();
  });

  it("shows the RICE score and rationale when evaluated", () => {
    render(
      <ProposalPanel
        detail={{
          ...base,
          reach: 100,
          impact: 2,
          confidence: 0.8,
          effort: 3,
          ai_rationale: "Alto impatto, sforzo contenuto",
        }}
      />,
    );
    expect(screen.getByText("Punteggio RICE")).toBeInTheDocument();
    expect(screen.getByText("reach")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Alto impatto, sforzo contenuto")).toBeInTheDocument();
  });

  it("lists comments with their author and offers the comment form", () => {
    render(<ProposalPanel detail={base} />);
    expect(screen.getByText("Serve anche sul mobile")).toBeInTheDocument();
    expect(screen.getByText(/Gino ·/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Aggiungi un commento/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Commenta" })).toBeInTheDocument();
  });

  it("offers edit/delete only on the current user's own comment", () => {
    // u3 non è né autore del commento c1 (u2) né proposer (u1): nessun controllo
    const { rerender } = render(<ProposalPanel detail={base} currentUserId="u3" />);
    expect(screen.queryByRole("button", { name: "Modifica" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elimina" })).not.toBeInTheDocument();

    rerender(<ProposalPanel detail={base} currentUserId="u2" />);
    expect(screen.getByRole("button", { name: "Modifica" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Elimina" })).toBeInTheDocument();
  });

  it("hides edit/delete on a crystallized proposal even for the author", () => {
    render(
      <ProposalPanel detail={{ ...base, status: "approvata" }} currentUserId="u2" />,
    );
    expect(screen.queryByRole("button", { name: "Modifica" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elimina" })).not.toBeInTheDocument();
  });

  it("shows empty states when there are no moves or comments", () => {
    render(<ProposalPanel detail={{ ...base, status_history: [], comments: [] }} />);
    expect(screen.getByText("Nessuno spostamento ancora.")).toBeInTheDocument();
    expect(screen.getByText("Nessun commento ancora.")).toBeInTheDocument();
  });
});
