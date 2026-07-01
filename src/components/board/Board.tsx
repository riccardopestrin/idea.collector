"use client";

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { useOptimistic, useState, useTransition } from "react";

import { updateProposalStatus } from "@/app/proposals/actions";
import { Column } from "@/components/board/Column";
import { ProposalCard } from "@/components/cards/ProposalCard";
import { BOARD_COLUMNS, groupByStatus, STATUS_LABELS } from "@/lib/board";
import type { ProposalListItem, ProposalStatus } from "@/lib/proposals";
import { BOARD_GAP } from "@/lib/tokens";

// Board a colonne per stato (ADR-0002). Unico Client Component e unico punto
// che conosce @dnd-kit: colonne e card restano presentazionali.
export function Board({
  proposals,
  canMove,
}: {
  proposals: ProposalListItem[];
  canMove: boolean;
}) {
  const [optimisticProposals, moveOptimistic] = useOptimistic(
    proposals,
    (current, move: { id: string; toStatus: ProposalStatus }) =>
      current.map((p) => (p.id === move.id ? { ...p, status: move.toStatus } : p)),
  );
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const id = String(active.id);
    const toStatus = over.id as ProposalStatus;
    const proposal = optimisticProposals.find((p) => p.id === id);
    if (!proposal || proposal.status === toStatus) return;
    setError(null);
    startTransition(async () => {
      moveOptimistic({ id, toStatus });
      const result = await updateProposalStatus(id, toStatus);
      if (result) setError(result.error);
    });
  }

  const groups = groupByStatus(optimisticProposals);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {/* id stabile: senza, il contatore interno di dnd-kit diverge tra SSR e client (hydration mismatch) */}
      <DndContext id="board" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={`flex flex-1 ${BOARD_GAP} overflow-x-auto pb-4`}>
          {BOARD_COLUMNS.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              proposals={groups[status]}
              canMove={canMove}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

// Wrapper che lega il droppable di @dnd-kit alla Column presentazionale.
function DroppableColumn({
  status,
  proposals,
  canMove,
}: {
  status: ProposalStatus;
  proposals: ProposalListItem[];
  canMove: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !canMove });
  return (
    <Column
      ref={setNodeRef}
      title={STATUS_LABELS[status]}
      count={proposals.length}
      isOver={isOver}
    >
      {proposals.map((proposal) => (
        <DraggableCard key={proposal.id} proposal={proposal} canMove={canMove} />
      ))}
    </Column>
  );
}

// Wrapper draggable della card: la <li> porta ref/listener, la card resta pura.
function DraggableCard({
  proposal,
  canMove,
}: {
  proposal: ProposalListItem;
  canMove: boolean;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: proposal.id,
    disabled: !canMove,
  });
  return (
    <li
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={
        transform
          ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
          : undefined
      }
      className={canMove ? `cursor-grab ${isDragging ? "z-10 opacity-70" : ""}` : undefined}
    >
      <ProposalCard proposal={proposal} />
    </li>
  );
}
