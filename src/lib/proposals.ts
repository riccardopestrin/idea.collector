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

// Componenti di un voto RICE (Claude o utente): stessa forma di ScoreFields
// meno il method, che è fissato dalla proposta.
export type VoteComponents = {
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
};

// Voto RICE di un utente su una proposta (migration 0015). Ogni componente su
// slider 1–10; un voto per utente, immutabile. `voter` embeddato per la lista.
export type RiceVote = VoteComponents & {
  id: string;
  voter_id: string;
  created_at: string;
  voter: { name: string | null; email: string } | null;
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
  votes: VoteComponents[];
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
  votes: RiceVote[];
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

// --- Voto composito normalizzato (Claude + utenti) ---
//
// Claude vota con le scale native RICE (reach/effort illimitati); gli utenti con
// slider 1–10. Per confrontarli portiamo ogni componente in [0,1] e calcoliamo
// un punteggio-prodotto 0–10 uguale per tutti:
//   RICE: 10 · reach · impact · confidence · (1 − effort)   (effort = costo)
//   ICE:  10 · impact · confidence · ease                   (ease positivo)
// Il totale composito è la media dei punteggi (Claude + ogni utente); i componenti
// medi sono le medie dei valori normalizzati (×10). Tutto in TS, coerente col DB.

// ponytail: reach/effort che mappano a 0.5 nella normalizzazione di Claude.
// Sono manopole di taratura — alzale se le reach/effort tipiche crescono.
export const RICE_REACH_MIDPOINT = 100;
export const RICE_EFFORT_MIDPOINT = 3;

type NormComponents = VoteComponents;

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const fromSlider = (v: number | null): number | null => (v === null ? null : clamp01((v - 1) / 9));

// Componenti di Claude → [0,1]. Per ICE i valori sono già 1–10 (come gli utenti).
function normalizeClaude(scores: ScoreFields): NormComponents {
  if (scores.method === "ice") {
    return {
      reach: null,
      impact: fromSlider(scores.impact),
      confidence: fromSlider(scores.confidence),
      effort: fromSlider(scores.effort),
    };
  }
  return {
    reach: scores.reach === null ? null : scores.reach / (scores.reach + RICE_REACH_MIDPOINT),
    impact: scores.impact === null ? null : clamp01((scores.impact - 0.25) / 2.75),
    confidence: scores.confidence === null ? null : clamp01(scores.confidence),
    effort: scores.effort === null ? null : scores.effort / (scores.effort + RICE_EFFORT_MIDPOINT),
  };
}

function normalizeVote(vote: VoteComponents): NormComponents {
  return {
    reach: fromSlider(vote.reach),
    impact: fromSlider(vote.impact),
    confidence: fromSlider(vote.confidence),
    effort: fromSlider(vote.effort),
  };
}

// Punteggio-prodotto 0–10 dai componenti normalizzati. null se manca un
// componente richiesto dal metodo.
function productScore(n: NormComponents, method: "rice" | "ice"): number | null {
  if (method === "ice") {
    if (n.impact === null || n.confidence === null || n.effort === null) return null;
    return 10 * n.impact * n.confidence * n.effort;
  }
  if (n.reach === null || n.impact === null || n.confidence === null || n.effort === null) {
    return null;
  }
  return 10 * n.reach * n.impact * n.confidence * (1 - n.effort);
}

const mean = (values: number[]): number | null =>
  values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

// Punteggio 0–10 di un singolo voto utente (per la lista votanti).
export function computeVoteScore(vote: VoteComponents, method: "rice" | "ice"): number | null {
  return productScore(normalizeVote(vote), method);
}

// Punteggio 0–10 della sola valutazione di Claude (sezione dedicata).
export function computeClaudeScore(scores: ScoreFields): number | null {
  return productScore(normalizeClaude(scores), scores.method);
}

export type CompositeScore = {
  // media dei punteggi (Claude + utenti); null se nessuno ha un punteggio valido
  total: number | null;
  claudeTotal: number | null;
  // medie 0–10 dei componenti normalizzati (Claude + utenti); null se assenti
  components: VoteComponents;
};

export function computeCompositeScore(
  proposal: ScoreFields,
  votes: VoteComponents[],
): CompositeScore {
  const norms = [normalizeClaude(proposal), ...votes.map(normalizeVote)];
  const totals = norms
    .map((n) => productScore(n, proposal.method))
    .filter((v): v is number => v !== null);
  const avgComponent = (field: keyof VoteComponents): number | null => {
    const scaled = norms
      .map((n) => n[field])
      .filter((v): v is number => v !== null)
      .map((v) => v * 10);
    return mean(scaled);
  };
  return {
    total: mean(totals),
    claudeTotal: computeClaudeScore(proposal),
    components: {
      reach: avgComponent("reach"),
      impact: avgComponent("impact"),
      confidence: avgComponent("confidence"),
      effort: avgComponent("effort"),
    },
  };
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
    .map((item) => ({ item, score: computeCompositeScore(item, item.votes).total }))
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
       confidence, effort, created_at, proposer_id, proposer:profiles(name, email),
       votes:rice_votes(reach, impact, confidence, effort)`,
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
                anchor_occurrence, author:profiles(name, email)),
       votes:rice_votes(id, voter_id, reach, impact, confidence, effort, created_at,
                voter:profiles(name, email))`,
    )
    .eq("id", id)
    .order("created_at", { referencedTable: "status_history", ascending: true })
    .order("created_at", { referencedTable: "comments", ascending: true })
    .order("created_at", { referencedTable: "rice_votes", ascending: true })
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
