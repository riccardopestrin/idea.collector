"use client";

import Link from "next/link";
import { useState } from "react";

import { controlClass } from "@/components/form/Field";
import { PROPOSAL_STATUSES, type ProposalStatus } from "@/lib/proposals";
import { STRINGS } from "@/lib/strings";

// Form filtri lista (GET): la pagina legge q/status dai searchParams. Client per
// gestire la × che pulisce il campo; "Azzera" torna alla lista piena via resetHref.
// showStatus=false nella board (la suddivisione in colonne è già il filtro stato).
export function ProposalFilters({
  search,
  status,
  showStatus = true,
  resetHref = "/",
}: {
  search: string;
  status?: ProposalStatus;
  showStatus?: boolean;
  resetHref?: string;
}) {
  const [q, setQ] = useState(search);
  const hasFilters = Boolean(search || status);

  return (
    <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
      <div className="relative min-w-48 flex-1">
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
            className="absolute right-2 top-1/2 -translate-y-1/2 text-lg leading-none text-foreground/50 hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>
      {showStatus && (
        <select
          name="status"
          defaultValue={status ?? ""}
          className={controlClass}
        >
          <option value="">{STRINGS.filters.allStatuses}</option>
          {PROPOSAL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STRINGS.status[s]}
            </option>
          ))}
        </select>
      )}
      <button type="submit" className="rounded-md border border-border px-4 py-2">
        {STRINGS.filters.submit}
      </button>
      {hasFilters && (
        <Link href={resetHref} className="rounded-md px-3 py-2 text-foreground/70 hover:text-foreground">
          {STRINGS.filters.reset}
        </Link>
      )}
    </form>
  );
}
