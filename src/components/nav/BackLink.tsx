import Link from "next/link";

// Link di ritorno in cima alle pagine secondarie (profilo, dettaglio, nuova
// proposta): la destinazione dipende dal contesto (lista progetti o board).
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="text-sm text-foreground/70 underline-offset-2 hover:underline">
      {label}
    </Link>
  );
}
