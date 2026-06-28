import { type ReactNode } from "react";

// Bottone di submit primario condiviso dai form (login, nuova proposta…).
export function SubmitButton({ children, pending }: { children: ReactNode; pending?: boolean }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-md bg-foreground px-4 py-2 text-background disabled:opacity-50"
    >
      {children}
    </button>
  );
}
