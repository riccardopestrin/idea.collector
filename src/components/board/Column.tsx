import type { ReactNode, Ref } from "react";

import { BOARD_COLUMN_WIDTH } from "@/lib/tokens";

// Segnale di drop durante il drag: consentito, vietato, o nessuno (fuori drag /
// colonna d'origine). Deciso in Board.tsx dalla macchina a stati.
export type DropHint = "valid" | "invalid" | null;

// Colonna della board, una per stato (ADR-0002). Presentazionale: il drop
// arriva da fuori via ref/isOver (il DnD vive solo in Board.tsx).
export function Column({
  title,
  count,
  isOver = false,
  dropHint = null,
  ref,
  children,
}: {
  title: string;
  count: number;
  isOver?: boolean;
  dropHint?: DropHint;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  const ring =
    dropHint === "valid"
      ? "ring-2 ring-green-500/60"
      : dropHint === "invalid"
        ? "ring-2 ring-red-500/60"
        : isOver
          ? "ring-2 ring-foreground/40"
          : "";
  return (
    <section
      ref={ref}
      aria-label={title}
      className={`${BOARD_COLUMN_WIDTH} flex shrink-0 flex-col gap-3 rounded-lg bg-foreground/5 p-3 ${ring} ${
        dropHint === "invalid" ? "cursor-not-allowed" : ""
      }`}
    >
      <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
        <span className="flex items-center gap-1.5">
          {title}
          {dropHint === "valid" && <CheckIcon />}
          {dropHint === "invalid" && <NoEntryIcon />}
        </span>
        <span className="font-normal text-foreground/50">{count}</span>
      </h2>
      <ul className="flex min-h-24 flex-1 flex-col gap-3">{children}</ul>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 text-green-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5 8.5 15 16 5.5" />
    </svg>
  );
}

function NoEntryIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="h-4 w-4 text-red-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M5 5 15 15" />
    </svg>
  );
}
