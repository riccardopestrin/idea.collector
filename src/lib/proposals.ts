import type { SupabaseClient } from "@supabase/supabase-js";

import { type AnchorField, markdownToPlainText, resolveAnchor } from "@/lib/anchors";

// Stati proposta — mirror dell'enum `proposal_status` in supabase/migrations/0001_init.sql.
export const PROPOSAL_STATUSES = [
  "nuova", "in_valutazione", "approvata", "in_sviluppo",
  "rilasciata", "archiviata", "rifiutata",
] as const;

export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number];

// Stato della valutazione AI — mirror dell'enum `ai_eval_status` (migration 0010).
export type AiEvalStatus = "assente" | "in_corso" | "completata" | "fallita";

// Campi di scoring condivisi tra card e pannello: bastano per il voto composito.
export type ScoreFields = {
  method: "rice" | "ice";
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
};

export type ProposalListItem = ScoreFields & {
  id: string;
  title: string;
  description: string | null;
  status: ProposalStatus;
  ai_eval_status: AiEvalStatus;
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
export type ProposalDetail = ScoreFields & {
  id: string;
  title: string;
  description: string | null;
  problem: string | null;
  status: ProposalStatus;
  ai_eval_status: AiEvalStatus;
  ai_eval_error: string | null;
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
  comments: ProposalComment[];
};

export type ProposalComment = {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author: PersonRef;
  anchor_field: AnchorField | null;
  anchor_text: string | null;
  anchor_occurrence: number | null;
  // ancora presente ma quote non più nel testo → orfano ("testo modificato")
  anchor_resolved: boolean;
};

export function isProposalStatus(value: string | undefined): value is ProposalStatus {
  return PROPOSAL_STATUSES.includes(value as ProposalStatus);
}

// Voto composito (RFC-003): RICE = (R × I × C) / E; ICE = I × C × E (E = Ease).
// Calcolato in TS, non a DB: sempre coerente con i componenti. null se un
// componente manca o se effort ≤ 0 (niente divisione per zero).
export function computeRiceScore(scores: ScoreFields): number | null {
  const { reach, impact, confidence, effort } = scores;
  if (reach === null || impact === null || confidence === null || effort === null) {
    return null;
  }
  if (scores.method === "ice") return impact * confidence * effort;
  if (effort <= 0) return null;
  return (reach * impact * confidence) / effort;
}

const scoreFormat = new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 });

// Formattazione unica dei numeri di scoring (voto totale e componenti).
export function formatScore(value: number): string {
  return scoreFormat.format(value);
}

// Classifica per voto composito decrescente; le proposte senza voto (componenti
// mancanti) vanno in coda. Il voto è calcolato una volta per proposta; sort
// stabile (ES2019+) → a parità di voto e tra le non votate resta l'ordine d'arrivo.
export function rankProposalsByScore(items: ProposalListItem[]): ProposalListItem[] {
  return items
    .map((item) => ({ item, score: computeRiceScore(item) }))
    .sort((a, b) => {
      if (a.score === null) return b.score === null ? 0 : 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    })
    .map((entry) => entry.item);
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
      `id, title, description, status, ai_eval_status, method, reach, impact,
       confidence, effort, created_at, proposer_id, proposer:profiles(name, email)`,
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
       effort, ai_rationale, ai_eval_status, ai_eval_error, links, internal_notes,
       created_at, proposer_id,
       proposer:profiles(name, email),
       status_history(id, from_status, to_status, created_at, author:profiles(name, email)),
       comments(id, body, created_at, author_id, anchor_field, anchor_text,
                anchor_occurrence, author:profiles(name, email))`,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "status_history", ascending: true })
    .order("created_at", { referencedTable: "comments", ascending: true })
    .maybeSingle()
    .overrideTypes<Omit<ProposalDetail, "comments"> & {
      comments: Omit<ProposalComment, "anchor_resolved">[];
    }, { merge: false }>();
  if (!data) return null;

  // Risoluzione ancore server-side (ADR-0005): N-esima occorrenza della quote
  // nella proiezione plain-text del campo corrente; assente → orfano.
  const plain = {
    description: markdownToPlainText(data.description ?? ""),
    problem: markdownToPlainText(data.problem ?? ""),
  };
  return {
    ...data,
    comments: data.comments.map((comment) => ({
      ...comment,
      anchor_resolved:
        comment.anchor_field !== null &&
        comment.anchor_text !== null &&
        comment.anchor_occurrence !== null &&
        resolveAnchor(plain[comment.anchor_field], {
          text: comment.anchor_text,
          occurrence: comment.anchor_occurrence,
        }) !== null,
    })),
  };
}
