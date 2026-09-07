"use client";

import { useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef } from "react";

import { XIcon } from "@/components/icons";
import { STRINGS } from "@/lib/strings";

const MAX_WIDTH = {
  sm: "max-w-lg",
  md: "max-w-3xl",
  lg: "max-w-6xl",
  xl: "max-w-[100rem]",
} as const;

// Overlay condiviso dalle intercepting route (dettaglio proposta, nuova
// proposta, profilo): <dialog> nativo per focus trap ed Esc; chiudere (Esc, X,
// click sul backdrop) torna alla pagina sotto con back(). size: sm profilo,
// md form nuova proposta (una colonna, ampio), xl dettaglio (quasi a tutta
// larghezza; l'altezza si riempie coi contenuti fino a max-h-90vh). La larghezza
// è comunque limitata a 100vw-2rem, quindi su schermi normali è ~piena.
export function DetailModal({
  children,
  size = "lg",
  fill = false,
}: {
  children: ReactNode;
  size?: keyof typeof MAX_WIDTH;
  // fill: altezza fissa 90vh, colonna flex — il contenuto riempie l'altezza
  // (dettaglio) invece di rimpicciolirsi coi contenuti corti.
  fill?: boolean;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  // true se il mousedown è partito sul backdrop: chiudiamo solo se il click
  // inizia E finisce lì. Senza, una selezione di testo trascinata dalla card
  // verso il bordo rilascia sul backdrop e chiudeva il modal (bug report).
  const downOnBackdrop = useRef(false);
  useEffect(() => ref.current?.showModal(), []);

  // Chiudere = tornare alla pagina sotto. NON chiamiamo dialog.close(): il close
  // nativo toglie il dialog dal top layer (backdrop via, salta in alto) un frame
  // prima che router.back() lo smonti, e in mezzo si vede il pannello scentrato
  // sulla board illuminata (glitch). Lasciandolo modale fino allo smontaggio,
  // elemento e backdrop spariscono insieme. onCancel intercetta l'Esc nativo.
  const close = () => router.back();

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === ref.current;
      }}
      onClick={(e) => {
        if (e.target === ref.current && downOnBackdrop.current) close();
      }}
      className={`m-auto w-[calc(100vw-2rem)] border border-ink bg-paper p-0 text-ink shadow-hard-lg backdrop:bg-ink/60 ${
        fill ? "flex h-[90vh] flex-col overflow-hidden" : "max-h-[90vh] overflow-y-auto"
      } ${MAX_WIDTH[size]}`}
    >
      <button
        type="button"
        aria-label={STRINGS.common.close}
        onClick={close}
        className="absolute right-0 top-0 border-b border-l border-ink bg-paper p-2 hover:bg-ink hover:text-paper"
      >
        <XIcon className="size-4" />
      </button>
      {children}
    </dialog>
  );
}
