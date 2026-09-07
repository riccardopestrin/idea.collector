import { act, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProjectListItem } from "@/lib/projects";

import { ProjectList } from "./ProjectList";

const reorderProjects = vi.hoisted(() => vi.fn(async () => null));
vi.mock("@/app/projects/actions", () => ({ reorderProjects }));

// Harness DnD: @dnd-kit è il confine di framework — qui si testa la logica reale
// di ProjectList (handleDragEnd + ordine ottimistico), invocando l'handler
// catturato come farebbe il DndContext vero.
type DragEnd = { active: { id: string }; over: { id: string } | null };
const dnd = vi.hoisted(() => ({ onDragEnd: undefined as ((e: DragEnd) => void) | undefined }));
vi.mock("@dnd-kit/core", () => ({
  DndContext: ({ children, onDragEnd }: { children: ReactNode; onDragEnd?: (e: DragEnd) => void }) => {
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

const project = (id: string, name: string): ProjectListItem => ({
  id,
  name,
  github_owner: null,
  github_repo: null,
  role: "admin",
  proposalCount: 0,
});

beforeEach(() => reorderProjects.mockClear());

describe("ProjectList", () => {
  it("persists the reordered ids after a card is dropped onto another", async () => {
    render(
      <ProjectList projects={[project("pr1", "A"), project("pr2", "B"), project("pr3", "C")]} />,
    );

    // trascina pr1 sopra pr3: [pr1,pr2,pr3] → [pr2,pr3,pr1]
    await act(async () => {
      dnd.onDragEnd?.({ active: { id: "pr1" }, over: { id: "pr3" } });
    });

    expect(reorderProjects).toHaveBeenCalledWith(["pr2", "pr3", "pr1"]);
  });

  it("ignores a drop on itself or outside any card", async () => {
    render(<ProjectList projects={[project("pr1", "A"), project("pr2", "B")]} />);

    await act(async () => dnd.onDragEnd?.({ active: { id: "pr1" }, over: null }));
    await act(async () => dnd.onDragEnd?.({ active: { id: "pr1" }, over: { id: "pr1" } }));

    expect(reorderProjects).not.toHaveBeenCalled();
  });

  it("makes the whole card its name a link to the board (drag the card, click the name)", () => {
    render(<ProjectList projects={[project("pr1", "A")]} />);
    // niente maniglia: come sulla board, il nome è il link, il resto è la presa
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A" })).toHaveAttribute("href", "/projects/pr1");
  });
});
