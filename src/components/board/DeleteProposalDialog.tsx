"use client";

import { useEffect, useRef } from "react";

import { controlClass } from "@/components/form/Field";
import { STRINGS } from "@/lib/strings";

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
      className="m-auto w-full max-w-md rounded-lg border border-border bg-background p-6 backdrop:bg-black/40"
    >
      <h2 className="font-semibold">{STRINGS.deleteDialog.heading(title)}</h2>
      <p className="mt-2 text-sm text-foreground/70">{STRINGS.deleteDialog.body}</p>
      <div className="mt-5 flex flex-wrap justify-end gap-3 text-sm">
        <button
          type="button"
          onClick={() => ref.current?.close()}
          disabled={busy}
          className={controlClass}
        >
          {STRINGS.common.cancel}
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={busy}
          className={`${controlClass} font-medium`}
        >
          {STRINGS.deleteDialog.moveToRejected}
        </button>
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          className="rounded-md bg-red-600 px-3 py-2 font-medium text-white"
        >
          {STRINGS.deleteDialog.confirm}
        </button>
      </div>
    </dialog>
  );
}
