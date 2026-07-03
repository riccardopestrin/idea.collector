import Link from "next/link";

// Link di ritorno riusato in cima alle pagine secondarie (profilo, dettaglio, nuova proposta).
export function BackLink({ href = "/", children = "← Torna alla board" }: { href?: string; children?: string }) {
  return (
    <Link href={href} className="text-sm text-foreground/70 underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
