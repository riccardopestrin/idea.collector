import type { SupabaseClient } from "@supabase/supabase-js";

// Stati proposta — mirror dell'enum `proposal_status` in supabase/migrations/0001_init.sql.
export const PROPOSAL_STATUSES = [
  "nuova", "in_valutazione", "approvata", "in_sviluppo",
  "rilasciata", "parcheggiata", "rifiutata",
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
