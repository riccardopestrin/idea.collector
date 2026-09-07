// Titolo di sezione del pannello: etichetta mono maiuscola, come una targhetta.
// text-sm (non il text-xs di labelClass): le sezioni del pannello dettaglio, che
// è grande, respirano di più.
export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="font-mono text-sm uppercase tracking-widest text-foreground/70">{children}</h2>
  );
}
