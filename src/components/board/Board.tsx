"use client";

import {
  DndContext,
  type DragEndEvent,
  type DragStartEvent,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { type ReactNode, useOptimistic, useState, useTransition } from "react";

import { deleteProposal, evaluateProposal, updateProposalStatus } from "@/app/proposals/actions";
import { Column, type DropHint } from "@/components/board/Column";
import { DeleteProposalDialog } from "@/components/board/DeleteProposalDialog";
import { ProposalCard } from "@/components/cards/ProposalCard";
import { BOARD_COLUMNS, groupByStatus } from "@/lib/board";
import type { ProposalListItem, ProposalStatus } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";
import { BOARD_GAP } from "@/lib/tokens";

// Board a colonne per stato (ADR-0002 + rettifica). Unico Client Component e
// unico punto che conosce @dnd-kit: colonne e card restano presentazionali.
// Tutti spostano tutto; elimina solo autore o admin, previa conferma.
export function Board({
  proposals,
  userId,
  isAdmin,
}: {
  proposals: ProposalListItem[];
  userId: string;
  isAdmin: boolean;
}) {
  const [optimisticProposals, moveOptimistic] = useOptimistic(
    proposals,
    (current, move: { id: string; toStatus: ProposalStatus }) =>
      current.map((p) => (p.id === move.id ? { ...p, status: move.toStatus } : p)),
  );
  const [error, setError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<ProposalListItem | null>(null);
  // stato della card trascinata: pilota lo spunta/divieto sulle colonne
  const [draggedStatus, setDraggedStatus] = useState<ProposalStatus | null>(null);
  const [isPending, startTransition] = useTransition();
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  function move(proposal: ProposalListItem, toStatus: ProposalStatus) {
    setError(null);
    startTransition(async () => {
      moveOptimistic({ id: proposal.id, toStatus });
      const result = await updateProposalStatus(proposal.id, proposal.status, toStatus);
      if (result) {
        setError(result.error);
        return;
      }
      // Auto-trigger RFC-003 (rettifica #9): la PRIMA uscita da "nuova" verso
      // qualunque stato lancia la valutazione AI, per qualsiasi utente. force=false
      // → l'idempotenza in runEvaluation fa sì che parta una volta sola. Fuori
      // dalla transition: il move è già committato e la UI non resta pending per
      // i ~30s di Claude; l'esito arriva via ai_eval_status (refresh), qui l'errore.
      if (proposal.status === "nuova") {
        void evaluateProposal(proposal.id).then((evalResult) => {
          if (evalResult) setError(evalResult.error);
        });
      }
    });
  }

  function handleDragStart({ active }: DragStartEvent) {
    const proposal = optimisticProposals.find((p) => p.id === String(active.id));
    setDraggedStatus(proposal?.status ?? null);
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDraggedStatus(null);
    if (!over) return;
    const toStatus = over.id as ProposalStatus;
    const proposal = optimisticProposals.find((p) => p.id === String(active.id));
    // #9: ogni colonna è un target valido; solo il drop sull'origine è no-op
    if (!proposal || proposal.status === toStatus) return;
    move(proposal, toStatus);
  }

  function handleDelete(proposal: ProposalListItem) {
    setError(null);
    startTransition(async () => {
      const result = await deleteProposal(proposal.id);
      if (result) setError(result.error);
      setPendingDelete(null);
    });
  }

  const groups = groupByStatus(optimisticProposals);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {/* id stabile: senza, il contatore interno di dnd-kit diverge tra SSR e client (hydration mismatch) */}
      <DndContext
        id="board"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={() => setDraggedStatus(null)}
      >
        <div className={`flex flex-1 ${BOARD_GAP} overflow-x-auto pb-4`}>
          {BOARD_COLUMNS.map((status) => (
            <DroppableColumn
              key={status}
              status={status}
              count={groups[status].length}
              dropHint={columnDropHint(draggedStatus, status)}
            >
              {groups[status].map((proposal) => (
                <DraggableCard
                  key={proposal.id}
                  proposal={proposal}
                  canRetryEval={isAdmin}
                  onDelete={
                    isAdmin || proposal.proposer_id === userId
                      ? () => setPendingDelete(proposal)
                      : undefined
                  }
                />
              ))}
            </DroppableColumn>
          ))}
        </div>
      </DndContext>
      {pendingDelete && (
        <DeleteProposalDialog
          title={pendingDelete.title}
          busy={isPending}
          onDelete={() => handleDelete(pendingDelete)}
          onReject={() => {
            move(pendingDelete, "rifiutata");
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}

// Spunta per una colonna durante il drag: null quando non si trascina o sulla
// colonna d'origine, "valid" altrimenti (#9: ogni altra colonna è un target valido).
function columnDropHint(dragged: ProposalStatus | null, column: ProposalStatus): DropHint {
  return dragged === null || dragged === column ? null : "valid";
}

// Wrapper che lega il droppable di @dnd-kit alla Column presentazionale.
function DroppableColumn({
  status,
  count,
  dropHint,
  children,
}: {
  status: ProposalStatus;
  count: number;
  dropHint: DropHint;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <Column
      ref={setNodeRef}
      title={STRINGS.status[status]}
      count={count}
      isOver={isOver}
      dropHint={dropHint}
    >
      {children}
    </Column>
  );
}

// Wrapper draggable della card: la <li> porta ref/listener, la card resta pura.
function DraggableCard({
  proposal,
  onDelete,
  canRetryEval,
}: {
  proposal: ProposalListItem;
  onDelete?: () => void;
  canRetryEval?: boolean;
}) {
  const { setNodeRef, attributes, listeners, transform, isDragging } = useDraggable({
    id: proposal.id,
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
      className={`cursor-grab ${isDragging ? "z-10 opacity-80" : ""}`}
    >
      <ProposalCard proposal={proposal} onDelete={onDelete} canRetryEval={canRetryEval} />
    </li>
  );
}
