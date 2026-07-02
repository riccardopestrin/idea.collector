import type { SupabaseClient } from "@supabase/supabase-js";

// Stati proposta — mirror dell'enum `proposal_status` in supabase/migrations/0001_init.sql.
export const PROPOSAL_STATUSES = [
  "nuova", "in_valutazione", "approvata", "in_sviluppo",
  "rilasciata", "archiviata", "rifiutata",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

export type ProposalListItem = {
  id: string;
  title: string;
  description: string | null;
  status: ProposalStatus;
  created_at: string;
  proposer_id: string;
  proposer: { name: string | null; email: string } | null;
};

type PersonRef = { name: string | null; email: string } | null;

// Label utente per la UI: nome se impostato, altrimenti email.
export function personLabel(person: PersonRef): string {
  return person?.name ?? person?.email ?? "sconosciuto";
}

// Dettaglio completo di una proposta per il pannello (Step 4): tutti i campi,
// cronologia stati e commenti, con gli autori embeddati.
export type ProposalDetail = {
  id: string;
  title: string;
  description: string | null;
  problem: string | null;
  status: ProposalStatus;
  method: "rice" | "ice";
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
  ai_rationale: string | null;
  links: string[];
  internal_notes: string | null;
  created_at: string;
  proposer_id: string;
  proposer: PersonRef;
  status_history: {
    id: string;
    from_status: ProposalStatus | null;
    to_status: ProposalStatus;
    created_at: string;
    author: PersonRef;
  }[];
  comments: {
    id: string;
    body: string;
    created_at: string;
    author: PersonRef;
  }[];
};

export function isProposalStatus(value: string | undefined): value is ProposalStatus {
  return PROPOSAL_STATUSES.includes(value as ProposalStatus);
}

// Data layer: legge le proposte con ricerca testo (titolo/descrizione) e filtro
// stato opzionali. RLS resta il backstop sull'autorizzazione.
export async function listProposals(
  supabase: SupabaseClient,
  { search, status }: { search?: string; status?: ProposalStatus },
): Promise<ProposalListItem[]> {
  let query = supabase
    .from("proposals")
    .select(
      "id, title, description, status, created_at, proposer_id, proposer:profiles(name, email)",
    )
    .order("created_at", { ascending: false });

  if (search) {
    // strip caratteri della grammatica filtri PostgREST (, ( ) *) per evitare
    // che un input rompa/estenda la .or — trust boundary.
    const safe = search.replace(/[,()*]/g, " ");
    query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`);
  }
  if (status) query = query.eq("status", status);

  // proposer è un embed to-one: PostgREST lo restituisce come oggetto singolo,
  // ma supabase-js senza tipi generati lo inferisce come array — corretto qui.
  const { data } = await query.overrideTypes<ProposalListItem[], { merge: false }>();
  return data ?? [];
}

// Data layer: legge il dettaglio completo (proposta + history + commenti) in
// un'unica query con embed PostgREST. null se non trovata (o id non-uuid).
export async function getProposalDetail(
  supabase: SupabaseClient,
  id: string,
): Promise<ProposalDetail | null> {
  const { data } = await supabase
    .from("proposals")
    .select(
      `id, title, description, problem, status, method, reach, impact, confidence,
       effort, ai_rationale, links, internal_notes, created_at, proposer_id,
       proposer:profiles(name, email),
       status_history(id, from_status, to_status, created_at, author:profiles(name, email)),
       comments(id, body, created_at, author:profiles(name, email))`,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "status_history", ascending: true })
    .order("created_at", { referencedTable: "comments", ascending: true })
    .maybeSingle()
    .overrideTypes<ProposalDetail, { merge: false }>();
  return data;
}
