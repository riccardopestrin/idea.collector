import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { ProposalDetail } from "@/lib/proposals";

import { ProposalPanel } from "./ProposalPanel";

// Le server action sono irrilevanti qui: i flussi sono testati via action test.
// runProposalScanAction è mockata anche per il trigger on-view (RFC-006).
const runProposalScanAction = vi.fn();
vi.mock("@/app/proposals/actions", () => ({
  addComment: vi.fn(),
  editComment: vi.fn(),
  deleteComment: vi.fn(),
  evaluateProposal: vi.fn(),
  runProposalScanAction: (...args: unknown[]) => runProposalScanAction(...args),
}));

const base: ProposalDetail = {
  id: "p1",
  title: "Dark mode",
  description: "Tema scuro per la dashboard",
  status: "in_valutazione",
  reach: null,
  impact: null,
  confidence: null,
  effort: null,
  ai_rationale: null,
  ai_eval_status: "assente",
  ai_eval_error: null,
  dup_scan_status: "assente",
  dup_scan_error: null,
  dup_flagged: false,
  dup_similarity: null,
  dup_report: null,
  dup_match: null,
  links: ["https://example.com/spec"],
  git_ref: null,
  task_url: null,
  internal_notes: null,
  created_at: "2026-07-01T10:00:00Z",
  proposer_id: "u1",
  project_id: "pr1",
  project: { github_owner: null, github_repo: null },
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
      promotion_status: "none",
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
    // media geometrica (8·6·4·5)^(1/4) ≈ 5,6 — mostrata come totale E come voto Claude
    expect(screen.getAllByText("5,6")).toHaveLength(2);
    // i fattori sono su scala 1–10 (Ease = effort invertito)
    expect(screen.getByText("Ease")).toBeInTheDocument();
  });

  it("shows the vote form to a non-proposer in any state except 'nuova' (#9c)", () => {
    // proposer (u1): mai il form
    const { rerender } = render(<ProposalPanel detail={base} currentUserId="u1" />);
    expect(screen.queryByRole("button", { name: "Invia voto" })).not.toBeInTheDocument();

    // altro utente, in valutazione: form presente
    rerender(<ProposalPanel detail={base} currentUserId="u2" />);
    expect(screen.getByRole("button", { name: "Invia voto" })).toBeInTheDocument();

    // #9c: anche in uno stato diverso (es. approvata) si può votare
    rerender(<ProposalPanel detail={{ ...base, status: "approvata" }} currentUserId="u2" />);
    expect(screen.getByRole("button", { name: "Invia voto" })).toBeInTheDocument();

    // tranne in 'nuova': niente voto
    rerender(<ProposalPanel detail={{ ...base, status: "nuova" }} currentUserId="u2" />);
    expect(screen.queryByRole("button", { name: "Invia voto" })).not.toBeInTheDocument();
  });

  it("offers an editable, prefilled vote form to a user who already voted, and lists the vote (#8)", () => {
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
    // #8: ha già votato → può aggiornarlo (form "Aggiorna voto", non più bloccato)
    expect(screen.getByRole("button", { name: "Aggiorna voto" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invia voto" })).not.toBeInTheDocument();
    expect(screen.getByText("Voti utenti (1)")).toBeInTheDocument();
    // voto massimo (tutti 10) → 10 sia nella riga utente sia nel totale composito
    const ginoRow = screen.getByText("Gino").closest("li");
    expect(ginoRow).not.toBeNull();
    expect(within(ginoRow as HTMLElement).getByText("10")).toBeInTheDocument();
    const totale = screen.getByText(/Voto totale/).closest("section");
    expect(totale).toHaveTextContent("10");
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

  it("shows the Branch/PR section to the proposer even when empty, but hides it from others", () => {
    const { rerender } = render(<ProposalPanel detail={base} currentUserId="u3" />);
    expect(screen.queryByRole("heading", { name: "Branch / PR" })).not.toBeInTheDocument();

    rerender(<ProposalPanel detail={base} currentUserId="u1" />);
    expect(screen.getByRole("heading", { name: "Branch / PR" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifica branch / PR" })).toBeInTheDocument();
  });

  it("shows a set git_ref to everyone as a link into the connected repo", () => {
    render(
      <ProposalPanel
        detail={{ ...base, git_ref: "#42" }}
        currentUserId="u3"
        repo={{ owner: "acme", name: "ideas" }}
      />,
    );
    expect(screen.getByRole("link", { name: "#42" })).toHaveAttribute(
      "href",
      "https://github.com/acme/ideas/pull/42",
    );
    expect(screen.queryByRole("button", { name: "Modifica branch / PR" })).not.toBeInTheDocument();
  });

  it("shows a set task URL to everyone as an outbound link", () => {
    render(
      <ProposalPanel
        detail={{ ...base, task_url: "https://app.clickup.com/t/86c1abc" }}
        currentUserId="u3"
      />,
    );
    expect(screen.getByRole("link", { name: "https://app.clickup.com/t/86c1abc" })).toHaveAttribute(
      "href",
      "https://app.clickup.com/t/86c1abc",
    );
    expect(screen.queryByRole("button", { name: "Modifica task ClickUp" })).not.toBeInTheDocument();
  });

  it("shows empty states when there are no moves or comments", () => {
    render(<ProposalPanel detail={{ ...base, status_history: [], comments: [] }} />);
    expect(screen.getByText("Nessuno spostamento ancora.")).toBeInTheDocument();
    expect(screen.getByText("Nessun commento ancora.")).toBeInTheDocument();
  });

  // --- promozione commento → contributo (migration 0016) ---

  const withPromotion = (promotion_status: "none" | "pending" | "accepted") => ({
    ...base,
    comments: [{ ...base.comments[0], promotion_status }],
  });

  it("offers 'Proponi come contributo' only to the comment author, never to the proposer", () => {
    // u2 è l'autore del commento su una proposta di u1: bottone presente
    const { rerender } = render(<ProposalPanel detail={base} currentUserId="u2" />);
    expect(screen.getByRole("button", { name: "Proponi come contributo" })).toBeInTheDocument();

    // u3 non è l'autore: niente bottone
    rerender(<ProposalPanel detail={base} currentUserId="u3" />);
    expect(
      screen.queryByRole("button", { name: "Proponi come contributo" }),
    ).not.toBeInTheDocument();

    // il proposer u1 che commenta la propria proposta non può candidarsi
    const ownComment = {
      ...base,
      comments: [{ ...base.comments[0], author_id: "u1" }],
    };
    rerender(<ProposalPanel detail={ownComment} currentUserId="u1" />);
    expect(
      screen.queryByRole("button", { name: "Proponi come contributo" }),
    ).not.toBeInTheDocument();
  });

  it("shows Accetta/Rifiuta on a pending comment to proposer and admin only", () => {
    const pending = withPromotion("pending");
    // il proposer u1 decide
    const { rerender } = render(<ProposalPanel detail={pending} currentUserId="u1" />);
    expect(screen.getByText("candidato contributo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Accetta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rifiuta" })).toBeInTheDocument();

    // l'autore u2 no
    rerender(<ProposalPanel detail={pending} currentUserId="u2" />);
    expect(screen.queryByRole("button", { name: "Accetta" })).not.toBeInTheDocument();

    // un admin non-proposer sì
    rerender(<ProposalPanel detail={pending} currentUserId="u3" isAdmin />);
    expect(screen.getByRole("button", { name: "Accetta" })).toBeInTheDocument();
  });

  it("renders an accepted contribution as an attributed paragraph and co-author in the header", () => {
    render(<ProposalPanel detail={withPromotion("accepted")} currentUserId="u3" />);
    expect(screen.getByText("Contributi")).toBeInTheDocument();
    // il body compare sia come contributo che come commento a lato
    expect(screen.getAllByText("Serve anche sul mobile").length).toBe(2);
    expect(screen.getByText("— Gino")).toBeInTheDocument();
    expect(screen.getByText(/di Fina · con Gino/)).toBeInTheDocument();
    expect(screen.getByText("contributo")).toBeInTheDocument();
  });

  it("offers 'Revoca partecipazione' to author and proposer, hiding Elimina for the author", () => {
    const accepted = withPromotion("accepted");
    // autore u2: revoca sì, elimina no (prima serve la revoca), modifica resta
    const { rerender } = render(<ProposalPanel detail={accepted} currentUserId="u2" />);
    expect(screen.getByRole("button", { name: "Revoca partecipazione" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Elimina" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Modifica" })).toBeInTheDocument();

    // proposer u1: revoca sì
    rerender(<ProposalPanel detail={accepted} currentUserId="u1" />);
    expect(screen.getByRole("button", { name: "Revoca partecipazione" })).toBeInTheDocument();

    // estraneo u3: no
    rerender(<ProposalPanel detail={accepted} currentUserId="u3" />);
    expect(
      screen.queryByRole("button", { name: "Revoca partecipazione" }),
    ).not.toBeInTheDocument();
  });

  it("hides promotion actions on a crystallized proposal but keeps the badge", () => {
    render(
      <ProposalPanel
        detail={{ ...withPromotion("accepted"), status: "approvata" }}
        currentUserId="u2"
      />,
    );
    expect(screen.getByText("contributo")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Revoca partecipazione" }),
    ).not.toBeInTheDocument();
  });

  it("hides the vote form from an accepted contributor (now a co-author)", () => {
    render(<ProposalPanel detail={withPromotion("accepted")} currentUserId="u2" />);
    expect(screen.queryByRole("button", { name: "Invia voto" })).not.toBeInTheDocument();
  });

  // --- scan anti-duplicato + competitor (RFC-006) ---

  const inNuova = { ...base, status: "nuova" as const };

  it("auto-triggers the duplicate scan on view for the proposer, not for a stranger", () => {
    const { unmount } = render(<ProposalPanel detail={inNuova} currentUserId="u1" />);
    expect(runProposalScanAction).toHaveBeenCalledWith("p1");
    unmount();

    runProposalScanAction.mockClear();
    render(<ProposalPanel detail={inNuova} currentUserId="u3" />);
    expect(runProposalScanAction).not.toHaveBeenCalled();
    // per chi non può lanciare lo scan nulla sta girando: niente "in corso"
    expect(
      screen.queryByText(/Scansione delle idee simili in corso/),
    ).not.toBeInTheDocument();
  });

  it("does not re-trigger the scan once it already ran", () => {
    render(
      <ProposalPanel
        detail={{ ...inNuova, dup_scan_status: "completata" }}
        currentUserId="u1"
      />,
    );
    expect(runProposalScanAction).not.toHaveBeenCalled();
  });

  it("shows the duplicate warning with similarity, link to the matched idea and its author", () => {
    render(
      <ProposalPanel
        detail={{
          ...inNuova,
          dup_scan_status: "completata",
          dup_flagged: true,
          dup_similarity: 91,
          dup_match: {
            id: "p0",
            title: "Mappa offline",
            proposer: { name: "Ada", email: "ada@test.local" },
          },
          dup_report: "Molto simile a «Mappa offline».",
        }}
        currentUserId="u1"
      />,
    );
    expect(screen.getByText(/Possibile duplicato/)).toBeInTheDocument();
    expect(screen.getByText(/91% simile/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "«Mappa offline»" })).toHaveAttribute(
      "href",
      "/proposals/p0",
    );
    expect(screen.getByText(/di Ada/)).toBeInTheDocument();
    expect(screen.getByText(/Non può uscire da «Nuova»/)).toBeInTheDocument();
    expect(screen.getByText("Molto simile a «Mappa offline».")).toBeInTheDocument();
  });

  it("linkifies only http(s) URLs inside the scan report", () => {
    render(
      <ProposalPanel
        detail={{
          ...inNuova,
          dup_scan_status: "completata",
          dup_report: "Fonte: https://trello.com/x e javascript:alert(1) restano.",
        }}
      />,
    );
    expect(screen.getByRole("link", { name: "https://trello.com/x" })).toHaveAttribute(
      "href",
      "https://trello.com/x",
    );
    expect(screen.queryByRole("link", { name: /javascript/ })).not.toBeInTheDocument();
  });

  it("offers 'Rilancia scansione' on a failed scan to the proposer, not to a stranger", () => {
    const failed = {
      ...inNuova,
      dup_scan_status: "fallita" as const,
      dup_scan_error: "timeout",
    };
    const { rerender } = render(<ProposalPanel detail={failed} currentUserId="u1" />);
    expect(screen.getByText(/Scansione fallita: timeout/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Rilancia scansione" })).toBeInTheDocument();

    rerender(<ProposalPanel detail={failed} currentUserId="u3" />);
    expect(
      screen.queryByRole("button", { name: "Rilancia scansione" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the historical report visible after 'nuova' without the running cue", () => {
    render(
      <ProposalPanel
        detail={{
          ...base,
          dup_scan_status: "completata",
          dup_report: "Nessun riscontro simile trovato.",
        }}
      />,
    );
    expect(screen.getByText("Nessun riscontro simile trovato.")).toBeInTheDocument();
    expect(screen.queryByText(/Scansione delle idee simili in corso/)).not.toBeInTheDocument();
  });
});
