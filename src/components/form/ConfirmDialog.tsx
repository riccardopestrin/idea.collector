import type { ReactNode, RefObject } from "react";

import { confirmDialogClass, displayClass } from "@/lib/tokens";

// <dialog> nativo di conferma (focus trap ed Esc gratis): titolo + testo. La riga
// dei bottoni la porta il chiamante (children): cambia forma (form, stato busy).
export function ConfirmDialog({
  ref,
  heading,
  body,
  onClose,
  children,
}: {
  ref: RefObject<HTMLDialogElement | null>;
  heading: string;
  body: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <dialog ref={ref} onClose={onClose} className={confirmDialogClass}>
      <h2 className={`${displayClass} text-xl`}>{heading}</h2>
      <p className="mt-3 text-sm text-foreground/70">{body}</p>
      {children}
    </dialog>
  );
}
