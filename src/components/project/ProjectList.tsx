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

import { reorderProjects } from "@/app/projects/actions";
import { ProjectCard } from "@/components/project/ProjectCard";
import type { ProjectListItem } from "@/lib/projects";

// Lista bacheche in home con riordino manuale (#6). Stessa meccanica di drag della
// board (Board.tsx): si prende tutta la card e la si trascina, il nome è un Link
// con stopPropagation, nessuna maniglia dedicata. Qui il bersaglio del drop è la
// card vicina (non una colonna). L'ordine è ottimistico e persiste per-utente.
export function ProjectList({ projects }: { projects: ProjectListItem[] }) {
  const [ordered, setOrdered] = useOptimistic(projects, (_current, next: ProjectListItem[]) => next);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  // stessi sensori della board
  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor));

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const from = ordered.findIndex((p) => p.id === active.id);
    const to = ordered.findIndex((p) => p.id === over.id);
    if (from === -1 || to === -1) return;
    const next = [...ordered];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setError(null);
    startTransition(async () => {
      setOrdered(next);
      const result = await reorderProjects(next.map((p) => p.id));
      if (result) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {/* id stabile per evitare mismatch SSR/client del contatore interno di dnd-kit */}
      <DndContext id="projects" sensors={sensors} onDragEnd={handleDragEnd}>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ordered.map((project) => (
            <ReorderableProjectCard key={project.id} project={project} />
          ))}
        </ul>
      </DndContext>
    </div>
  );
}

// Wrapper draggable+droppable della card, gemello di DraggableCard della board:
// la <li> porta ref/listener e trasla col cursore, la card resta pura. Qui è
// anche droppable perché il drop avviene su una card vicina (riordino), non su
// una colonna.
function ReorderableProjectCard({ project }: { project: ProjectListItem }) {
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: project.id });
  const {
    setNodeRef: setDragRef,
    attributes,
    listeners,
    transform,
    isDragging,
  } = useDraggable({ id: project.id });
  return (
    <li
      ref={(node) => {
        setDropRef(node);
        setDragRef(node);
      }}
      {...attributes}
      {...listeners}
      style={
        transform ? { transform: `translate(${transform.x}px, ${transform.y}px)` } : undefined
      }
      className={`cursor-grab ${isDragging ? "z-10 opacity-80" : ""} ${
        isOver ? "ring-2 ring-ink" : ""
      }`}
    >
      <ProjectCard project={project} />
    </li>
  );
}
