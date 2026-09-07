"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import { XIcon } from "@/components/icons";
import { STRINGS } from "@/lib/strings";

// Overlay condiviso dalle intercepting route (dettaglio proposta, nuova
// proposta, profilo): <dialog> nativo per focus trap ed Esc; chiudere (Esc, X,
// click sul backdrop) torna alla pagina sotto con back(). narrow: finestra
// stretta per i form a una colonna.
export function DetailModal({ children, narrow = false }: { children: ReactNode; narrow?: boolean }) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => ref.current?.showModal(), []);

  return (
    <dialog
      ref={ref}
      onClose={() => router.back()}
      onClick={(e) => {
        if (e.target === ref.current) ref.current.close();
      }}
      className={`m-auto max-h-[85vh] w-[calc(100vw-2rem)] overflow-y-auto border border-ink bg-paper p-0 text-ink shadow-hard-lg backdrop:bg-ink/60 ${
        narrow ? "max-w-lg" : "max-w-6xl"
      }`}
    >
      <button
        type="button"
        aria-label={STRINGS.common.close}
        onClick={() => ref.current?.close()}
        className="absolute right-0 top-0 border-b border-l border-ink bg-paper p-2 hover:bg-ink hover:text-paper"
      >
        <XIcon className="size-4" />
      </button>
      {children}
    </dialog>
  );
}
