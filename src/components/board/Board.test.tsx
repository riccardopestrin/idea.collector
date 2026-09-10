import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { BOARD_COLUMNS } from "@/lib/board";
import type { ProposalListItem } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";

import { Board } from "./Board";

type ActionResult = { error: string } | null;

const { updateProposalStatus, deleteProposal, evaluateProposal, runProposalScanAction } =
  vi.hoisted(() => ({
    updateProposalStatus: vi.fn(async (): Promise<ActionResult> => null),
    deleteProposal: vi.fn(async (): Promise<ActionResult> => null),
    evaluateProposal: vi.fn(async (): Promise<ActionResult> => null),
    runProposalScanAction: vi.fn(async (): Promise<ActionResult> => null),
  }));
vi.mock("@/app/proposals/actions", () => ({
  updateProposalStatus,
  deleteProposal,
  evaluateProposal,
  runProposalScanAction,
}));

// Harness DnD: @dnd-kit è il confine di framework — qui si testa la logica
// reale di Board (handleDragStart/handleDragEnd, gate canMoveTo, auto-eval),
// invocando gli handler catturati come farebbe il DndContext vero.
type DragStart = { active: { id: string } };
type DragEnd = { active: { id: string }; over: { id: string } | null };
const dnd = vi.hoisted(() => ({
  onDragStart: undefined as ((e: DragStart) => void) | undefined,
  onDragEnd: undefined as ((e: DragEnd) => void) | undefined,
}));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({
    children,
    onDragStart,
    onDragEnd,
  }: {
    children: ReactNode;
    onDragStart?: (e: DragStart) => void;
    onDragEnd?: (e: DragEnd) => void;
  }) => {
    dnd.onDragStart = onDragStart;
    dnd.onDragEnd = onDragEnd;
    return <>{children}</>;
  },
  useDraggable: () => ({
    setNodeRef: () => {},
    attributes: {},
    listeners: {},
    transform: null,
    isDragging: false,
  }),
  useDroppable: () => ({ setNodeRef: () => {}, isOver: false }),
  useSensor: () => null,
  useSensors: () => [],
  PointerSensor: class {},
  KeyboardSensor: class {},
}));

// Simula un drag completo: pick-up della card e drop sulla colonna target.
function drag(id: string, to: string | null) {
  act(() => dnd.onDragStart?.({ active: { id } }));
  act(() => dnd.onDragEnd?.({ active: { id }, over: to ? { id: to } : null }));
}

// Fa girare la transition async di move()/handleDelete fino a quiete.
const flush = () => act(async () => {});

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
  reach: null,
  impact: null,
  confidence: null,
  effort: null,
  ai_eval_status: "assente",
  dup_scan_status: "assente",
  dup_flagged: false,
  created_at: "2026-01-01",
  proposer_id: proposerId,
  proposer: null,
  votes: [],
  contributors: [],
});

describe("Board", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders one column per status, in flow order, with its label", () => {
    render(<Board proposals={[]} userId="u1" isAdmin={false} />);

    const headings = screen.getAllByRole("heading", { level: 2 });
    expect(headings.map((h) => h.textContent)).toEqual(
      BOARD_COLUMNS.map((s) => `${STRINGS.status[s]}0`),
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

  it("moves a dropped card via updateProposalStatus and does not eval a move that stays out of 'nuova'", async () => {
    render(
      <Board proposals={[proposal("1", "approvata", "Mia")]} userId="u1" isAdmin={false} />,
    );

    drag("1", "in_sviluppo");
    await flush();

    expect(updateProposalStatus).toHaveBeenCalledWith("1", "approvata", "in_sviluppo");
    // non parte da 'nuova': niente auto-eval
    expect(evaluateProposal).not.toHaveBeenCalled();
  });

  it("ignores a drop on the origin column, outside any column, or on a forbidden target (#10)", async () => {
    render(
      <Board
        proposals={[proposal("1", "nuova", "Mia"), proposal("2", "approvata", "Tua")]}
        userId="u1"
        isAdmin={false}
      />,
    );

    drag("1", "nuova"); // colonna d'origine
    drag("1", null); // drop fuori da ogni colonna
    drag("1", "approvata"); // da 'nuova' solo verso 'in_valutazione'
    drag("2", "nuova"); // in 'nuova' non si torna
    await flush();

    expect(updateProposalStatus).not.toHaveBeenCalled();
    expect(evaluateProposal).not.toHaveBeenCalled();
  });

  it("auto-triggers the AI evaluation on the move out of 'nuova', for any user (#10)", async () => {
    render(<Board proposals={[proposal("1", "nuova", "Mia")]} userId="u1" isAdmin={false} />);

    drag("1", "in_valutazione");
    await flush();

    expect(updateProposalStatus).toHaveBeenCalledWith("1", "nuova", "in_valutazione");
    expect(evaluateProposal).toHaveBeenCalledWith("1");
  });

  it("shows the move error in the alert region and skips the auto-eval", async () => {
    updateProposalStatus.mockResolvedValueOnce({
      error: "La proposta è stata spostata da qualcun altro. Ricarica la pagina.",
    });
    render(<Board proposals={[proposal("1", "nuova", "Mia")]} userId="u1" isAdmin />);

    drag("1", "in_valutazione");
    await flush();

    expect(screen.getByRole("alert")).toHaveTextContent("spostata da qualcun altro");
    expect(evaluateProposal).not.toHaveBeenCalled();
  });

  it("marks only the forbidden columns with the no-entry icon during a drag (#10)", () => {
    render(
      <Board proposals={[proposal("1", "nuova", "Mia")]} userId="u1" isAdmin={false} />,
    );
    const forbiddenIn = (column: string) =>
      within(screen.getByRole("region", { name: column })).queryByRole("img", {
        name: "Qui non si può spostare",
      });

    act(() => dnd.onDragStart?.({ active: { id: "1" } }));
    // da 'nuova': solo In Valutazione è consentita (nessun segnale), le altre sono vietate
    expect(forbiddenIn("In Valutazione")).toBeNull();
    expect(forbiddenIn("Approvata")).not.toBeNull();
    expect(forbiddenIn("Nuova")).toBeNull(); // origine: nessun segnale

    // il drop (anche a vuoto) azzera i segnali
    act(() => dnd.onDragEnd?.({ active: { id: "1" }, over: null }));
    expect(forbiddenIn("Approvata")).toBeNull();
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

  it("offers 'Sposta in Rifiutata' as the conservative alternative, except from 'nuova' (#10)", async () => {
    const user = userEvent.setup();
    const { unmount } = render(
      <Board proposals={[proposal("1", "in_valutazione", "Mia", "u1")]} userId="u1" isAdmin={false} />,
    );

    await user.click(screen.getByRole("button", { name: "Elimina Mia" }));
    await user.click(screen.getByRole("button", { name: "Sposta in Rifiutata" }));

    expect(updateProposalStatus).toHaveBeenCalledWith("1", "in_valutazione", "rifiutata");
    expect(deleteProposal).not.toHaveBeenCalled();

    // da 'nuova' non si va in Rifiutata: resta solo l'eliminazione
    unmount();
    render(
      <Board proposals={[proposal("2", "nuova", "Tua", "u1")]} userId="u1" isAdmin={false} />,
    );
    await user.click(screen.getByRole("button", { name: "Elimina Tua" }));
    expect(screen.queryByRole("button", { name: "Sposta in Rifiutata" })).not.toBeInTheDocument();
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
