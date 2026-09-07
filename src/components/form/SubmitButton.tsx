import { type ReactNode } from "react";

import { primaryButtonClass } from "@/lib/tokens";

// Bottone di submit primario condiviso dai form (login, nuova proposta…).
export function SubmitButton({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <button type="submit" disabled={pending} className={primaryButtonClass}>
      {children}
    </button>
  );
}
