"use client";

import Link from "next/link";
import { useState } from "react";

import { PROPOSAL_STATUSES, type ProposalStatus } from "@/lib/proposals";

// Form filtri lista (GET): la home legge q/status dai searchParams. Client per
// gestire la × che pulisce il campo; "Azzera" torna alla board piena via /.
export function ProposalFilters({
  search,
  status,
}: {
  search: string;
  status: ProposalStatus | undefined;
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
          placeholder="Cerca per titolo o descrizione…"
          className="w-full rounded-md border border-border px-3 py-2 pr-9"
        />
        {q && (
          <button
            type="button"
            onClick={() => setQ("")}
            aria-label="Cancella ricerca"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-lg leading-none text-foreground/50 hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>
      <select
        name="status"
        defaultValue={status ?? ""}
        className="rounded-md border border-border px-3 py-2"
      >
        <option value="">Tutti gli stati</option>
        {PROPOSAL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <button type="submit" className="rounded-md border border-border px-4 py-2">
        Filtra
      </button>
      {hasFilters && (
        <Link href="/" className="rounded-md px-3 py-2 text-foreground/70 hover:text-foreground">
          Azzera
        </Link>
      )}
    </form>
  );
}
