import { labelClass } from "@/lib/tokens";

// Titolo di sezione del pannello: etichetta mono maiuscola, come una targhetta.
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className={`${labelClass} text-foreground/70`}>{children}</h2>;
}
