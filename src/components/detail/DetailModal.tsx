"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

// Overlay del dettaglio (intercepting route): <dialog> nativo per focus trap
// ed Esc; chiudere (Esc, ×, click sul backdrop) torna alla board con back().
export function DetailModal({ children }: { children: ReactNode }) {
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
      className="m-auto max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-background p-0 backdrop:bg-black/40"
    >
      <button
        type="button"
        aria-label="Chiudi"
        onClick={() => ref.current?.close()}
        className="absolute right-2 top-2 rounded p-1.5 leading-none text-foreground/40 hover:text-foreground"
      >
        ×
      </button>
      {children}
    </dialog>
  );
}
