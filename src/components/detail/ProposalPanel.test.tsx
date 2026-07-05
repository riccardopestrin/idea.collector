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
  votes: [],
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

  it("renders the status history with transition, author and hides the score sections when unscored", () => {
    render(<ProposalPanel detail={base} />);
    expect(screen.getByText(/Nuova → In Valutazione/)).toBeInTheDocument();
    expect(screen.getByText(/gino@test\.local/)).toBeInTheDocument();
    expect(screen.queryByText("Voto di Claude")).not.toBeInTheDocument();
    expect(screen.queryByText(/Voto totale/)).not.toBeInTheDocument();
  });

  it("shows Claude's RICE-10 total and rationale when evaluated", () => {
    render(
      <ProposalPanel
        detail={{
          ...base,
          reach: 8,
          impact: 6,
          confidence: 4,
          effort: 5,
          ai_rationale: "Alto impatto, sforzo contenuto",
        }}
      />,
    );
    expect(screen.getByText("Voto di Claude")).toBeInTheDocument();
    expect(screen.getByText("Alto impatto, sforzo contenuto")).toBeInTheDocument();
    // media geometrica (8·6·4·5)^(1/4) ≈ 5,6 — mostrata come totale e come voto Claude
    expect(screen.getAllByText("5,6").length).toBeGreaterThan(0);
    // i fattori sono su scala 1–10 (Ease = effort invertito)
    expect(screen.getByText("Ease")).toBeInTheDocument();
  });

  it("shows the vote form only to a non-proposer who has not voted, in valutazione", () => {
    // proposer (u1): mai il form
    const { rerender } = render(<ProposalPanel detail={base} currentUserId="u1" />);
    expect(screen.queryByRole("button", { name: "Invia voto" })).not.toBeInTheDocument();

    // altro utente che non ha votato: form presente
    rerender(<ProposalPanel detail={base} currentUserId="u2" />);
    expect(screen.getByRole("button", { name: "Invia voto" })).toBeInTheDocument();

    // fuori da 'in_valutazione': mai il form
    rerender(<ProposalPanel detail={{ ...base, status: "approvata" }} currentUserId="u2" />);
    expect(screen.queryByRole("button", { name: "Invia voto" })).not.toBeInTheDocument();
  });

  it("hides the vote form and lists a user's own vote with its 1–10 score", () => {
    const detail = {
      ...base,
      votes: [
        {
          id: "v1",
          voter_id: "u2",
          reach: 10,
          impact: 10,
          confidence: 10,
          effort: 10,
          created_at: "2026-07-03T10:00:00Z",
          voter: { name: "Gino", email: "gino@test.local" },
        },
      ],
    };
    render(<ProposalPanel detail={detail} currentUserId="u2" />);
    // ha già votato → niente form
    expect(screen.queryByRole("button", { name: "Invia voto" })).not.toBeInTheDocument();
    expect(screen.getByText("Voti utenti (1)")).toBeInTheDocument();
    expect(screen.getByText("Gino")).toBeInTheDocument();
    // voto massimo (tutti 10) → 10 (compare nel totale composito e nella riga utente)
    expect(screen.getAllByText("10").length).toBeGreaterThan(0);
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
