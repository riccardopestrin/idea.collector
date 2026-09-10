import type { ReactNode, Ref } from "react";

import { NoEntryIcon } from "@/components/icons";
import { STRINGS } from "@/lib/strings";
import { BOARD_COLUMN_WIDTH, labelClass } from "@/lib/tokens";

// Colonna della board, una per stato (ADR-0002). Presentazionale: il drop
// arriva da fuori via ref (il DnD vive solo in Board.tsx). Durante il drag
// l'unico segnale è il divieto sulle colonne vietate: i bordi non cambiano mai.
export function Column({
  title,
  count,
  forbidden = false,
  ref,
  children,
}: {
  title: string;
  count: number;
  forbidden?: boolean;
  ref?: Ref<HTMLElement>;
  children: ReactNode;
}) {
  return (
    <section
      ref={ref}
      aria-label={title}
      className={`${BOARD_COLUMN_WIDTH} flex shrink-0 flex-col border border-ink ${
        forbidden ? "cursor-not-allowed" : ""
      }`}
    >
      <h2 className={`flex items-center justify-between border-b border-ink px-3 py-2 ${labelClass}`}>
        <span className="flex items-center gap-2">
          {title}
          {forbidden && (
            <NoEntryIcon
              role="img"
              aria-hidden={false}
              aria-label={STRINGS.board.forbiddenTarget}
              className="size-3.5 text-paprika"
            />
          )}
        </span>
        <span className="text-foreground/50">{count}</span>
      </h2>
      <ul className="flex min-h-24 flex-1 flex-col gap-3 p-3">{children}</ul>
    </section>
  );
}
