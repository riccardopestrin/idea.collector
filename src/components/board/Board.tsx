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
import { type ReactNode, useOptimistic, useState, useTransition } from "react";

import { deleteProposal, evaluateProposal, updateProposalStatus } from "@/app/proposals/actions";
import { Column } from "@/components/board/Column";
import { DeleteProposalDialog } from "@/components/board/DeleteProposalDialog";
import { ProposalCard } from "@/components/cards/ProposalCard";
import { BOARD_COLUMNS, groupByStatus, STATUS_LABELS } from "@/lib/board";
import type { ProposalListItem, ProposalStatus } from "@/lib/proposals";
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
      // Auto-trigger RFC-003: il move di un admin in "in_valutazione" lancia la
      // valutazione AI FUORI dalla transition: il move è già committato e la UI
      // non resta pending per i ~30s della chiamata a Claude. L'esito arriva
      // via ai_eval_status (refresh dell'azione); qui solo l'eventuale errore.
      if (isAdmin && toStatus === "in_valutazione") {
        void evaluateProposal(proposal.id).then((evalResult) => {
          if (evalResult) setError(evalResult.error);
        });
      }
    });
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over) return;
    const toStatus = over.id as ProposalStatus;
    const proposal = optimisticProposals.find((p) => p.id === String(active.id));
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
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      {/* id stabile: senza, il contatore interno di dnd-kit diverge tra SSR e client (hydration mismatch) */}
      <DndContext id="board" sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={`flex flex-1 ${BOARD_GAP} overflow-x-auto pb-4`}>
          {BOARD_COLUMNS.map((status) => (
            <DroppableColumn key={status} status={status} count={groups[status].length}>
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

// Wrapper che lega il droppable di @dnd-kit alla Column presentazionale.
function DroppableColumn({
  status,
  count,
  children,
}: {
  status: ProposalStatus;
  count: number;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <Column ref={setNodeRef} title={STATUS_LABELS[status]} count={count} isOver={isOver}>
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
      className={`cursor-grab ${isDragging ? "z-10 opacity-70" : ""}`}
    >
      <ProposalCard proposal={proposal} onDelete={onDelete} canRetryEval={canRetryEval} />
    </li>
  );
}
