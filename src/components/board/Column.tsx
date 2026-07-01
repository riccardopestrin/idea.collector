import type { ReactNode, Ref } from "react";

import { BOARD_COLUMN_WIDTH } from "@/lib/tokens";

// Colonna della board, una per stato (ADR-0002). Presentazionale: il drop
// arriva da fuori via ref/isOver (il DnD vive solo in Board.tsx).
export function Column({
  title,
  count,
  isOver = false,
  ref,
  children,
}: {
  title: string;
  count: number;
  isOver?: boolean;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section
      ref={ref}
      aria-label={title}
      className={`${BOARD_COLUMN_WIDTH} flex shrink-0 flex-col gap-3 rounded-lg bg-foreground/5 p-3 ${
        isOver ? "ring-2 ring-foreground/40" : ""
      }`}
    >
      <h2 className="flex items-center justify-between px-1 text-sm font-semibold">
        {title}
        <span className="font-normal text-foreground/50">{count}</span>
      </h2>
      <ul className="flex min-h-24 flex-1 flex-col gap-3">{children}</ul>
    </section>
  );
}
