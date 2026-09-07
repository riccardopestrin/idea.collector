"use client";

import Link from "next/link";
import { useState } from "react";

import { XIcon } from "@/components/icons";
import { PROPOSAL_STATUSES, type ProposalStatus } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";
import { buttonClass, controlClass, labelClass, linkClass, tagClass } from "@/lib/tokens";

// Form filtri lista (GET): la pagina legge q/status dai searchParams. Client per
// gestire la × che pulisce il campo; "Reset" torna alla lista piena (basePath).
// showStatus=false nella board (la suddivisione in colonne è già il filtro stato).
// Gli stati sono chip-link cumulabili in OR (`status=a,b`): un click aggiunge o
// toglie lo stato, "Tutti gli stati" azzera la selezione. Il campo hidden li
// conserva quando si cerca per testo.
export function ProposalFilters({
  search,
  statuses = [],
  showStatus = true,
  basePath,
}: {
  search: string;
  statuses?: ProposalStatus[];
  showStatus?: boolean;
  // pagina che ospita i filtri: base di ogni chip e del reset
  basePath: string;
}) {
  const [q, setQ] = useState(search);
  const hasFilters = Boolean(search || statuses.length > 0);
  const hrefFor = (next: ProposalStatus[]) => ({
    pathname: basePath,
    query: { ...(search && { q: search }), ...(next.length > 0 && { status: next.join(",") }) },
  });
  const toggled = (s: ProposalStatus) =>
    statuses.includes(s) ? statuses.filter((x) => x !== s) : [...statuses, s];
  const chipClass = (active: boolean) =>
    `${tagClass} border-ink px-2.5 py-1 ${
      active ? "bg-ink text-paper hover:border-paprika hover:bg-paprika" : "hover:bg-ink hover:text-paper"
    }`;

  return (
    <div className="flex flex-col gap-3">
      <form method="get" className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-48 flex-1 sm:max-w-md">
          <input
            type="text"
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={STRINGS.filters.searchPlaceholder}
            className={`w-full ${controlClass} pr-9`}
          />
          {q && (
            <button
              type="button"
              onClick={() => setQ("")}
              aria-label={STRINGS.filters.clearSearch}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-foreground/50 hover:text-ink"
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </div>
        {statuses.length > 0 && <input type="hidden" name="status" value={statuses.join(",")} />}
        <button type="submit" className={buttonClass}>
          {STRINGS.filters.submit}
        </button>
        {hasFilters && (
          <Link href={basePath} className={`px-2 ${labelClass} ${linkClass}`}>
            {STRINGS.filters.reset}
          </Link>
        )}
      </form>
      {showStatus && (
        <nav aria-label={STRINGS.filters.statusLabel} className="flex flex-wrap gap-1.5">
          <Link
            href={hrefFor([])}
            aria-pressed={statuses.length === 0}
            className={chipClass(statuses.length === 0)}
          >
            {STRINGS.filters.allStatuses}
          </Link>
          {PROPOSAL_STATUSES.map((s) => {
            const active = statuses.includes(s);
            return (
              <Link key={s} href={hrefFor(toggled(s))} aria-pressed={active} className={chipClass(active)}>
                {STRINGS.status[s]}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}
