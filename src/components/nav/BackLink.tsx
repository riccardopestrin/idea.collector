import Link from "next/link";

import { ArrowLeftIcon } from "@/components/icons";
import { labelClass, linkClass } from "@/lib/tokens";

// Link di ritorno in cima alle pagine secondarie (dettaglio, nuova proposta,
// nuovo progetto): la destinazione dipende dal contesto (lista progetti o board).
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className={`inline-flex w-fit items-center gap-1.5 ${labelClass} ${linkClass}`}>
      <ArrowLeftIcon className="size-3.5" />
      {label}
    </Link>
  );
}
