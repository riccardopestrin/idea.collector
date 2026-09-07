import type { ReactNode, Ref } from "react";

import { CheckIcon, NoEntryIcon } from "@/components/icons";
import { BOARD_COLUMN_WIDTH, labelClass } from "@/lib/tokens";

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
      ? "ring-2 ring-ink"
      : dropHint === "invalid"
        ? "ring-2 ring-paprika"
        : isOver
          ? "ring-2 ring-dust"
          : "";
  return (
    <section
      ref={ref}
      aria-label={title}
      className={`${BOARD_COLUMN_WIDTH} flex shrink-0 flex-col border border-ink ${ring} ${
        dropHint === "invalid" ? "cursor-not-allowed" : ""
      }`}
    >
      <h2 className={`flex items-center justify-between border-b border-ink px-3 py-2 ${labelClass}`}>
        <span className="flex items-center gap-2">
          {title}
          {dropHint === "valid" && <CheckIcon className="size-3.5" />}
          {dropHint === "invalid" && <NoEntryIcon className="size-3.5 text-paprika" />}
        </span>
        <span className="text-foreground/50">{count}</span>
      </h2>
      <ul className="flex min-h-24 flex-1 flex-col gap-3 p-3">{children}</ul>
    </section>
  );
}
