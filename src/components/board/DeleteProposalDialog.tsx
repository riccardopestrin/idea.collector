"use client";

import { useEffect, useRef } from "react";

import { STRINGS } from "@/lib/strings";
import { ConfirmDialog } from "@/components/form/ConfirmDialog";
import { buttonClass, confirmActionsClass, dangerButtonClass } from "@/lib/tokens";

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
    <ConfirmDialog
      ref={ref}
      onClose={onClose}
      heading={STRINGS.deleteDialog.heading(title)}
      body={STRINGS.deleteDialog.body}
    >
      <div className={confirmActionsClass}>
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
    </ConfirmDialog>
  );
}
