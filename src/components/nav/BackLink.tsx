import Link from "next/link";

import { STRINGS } from "@/lib/strings";

// Link di ritorno alla board, in cima alle pagine secondarie (profilo, dettaglio, nuova proposta).
export function BackLink() {
  return (
    <Link href="/" className="text-sm text-foreground/70 underline-offset-2 hover:underline">
      {STRINGS.nav.backToBoard}
    </Link>
  );
}
