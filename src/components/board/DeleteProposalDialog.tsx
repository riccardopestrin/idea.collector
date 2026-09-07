"use client";

import { useEffect, useRef } from "react";

import { STRINGS } from "@/lib/strings";
import { buttonClass, dangerButtonClass, displayClass } from "@/lib/tokens";

// Conferma di eliminazione (rettifica ADR-0002): l'eliminazione è definitiva e
// cancella anche la history, quindi il dialog propone "Sposta in Rifiutata"
// come alternativa conservativa. <dialog> nativo: focus trap ed Esc gratis.
export function DeleteProposalDialog({
  title,
  busy,
  onDelete,
  onReject,
  onClose,
}: {
  title: string;
  busy: boolean;
  onDelete: () => void;
  onReject: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-full max-w-md border border-ink bg-paper p-6 text-ink shadow-hard-lg backdrop:bg-ink/60"
    >
      <h2 className={`${displayClass} text-xl`}>{STRINGS.deleteDialog.heading(title)}</h2>
      <p className="mt-3 text-sm text-foreground/70">{STRINGS.deleteDialog.body}</p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={() => ref.current?.close()} disabled={busy} className={buttonClass}>
          {STRINGS.common.cancel}
        </button>
        <button type="button" onClick={onReject} disabled={busy} className={buttonClass}>
          {STRINGS.deleteDialog.moveToRejected}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className={dangerButtonClass}
        >
          {STRINGS.deleteDialog.confirm}
        </button>
      </div>
    </dialog>
  );
}
