# RFC-006: Scan anti-duplicato locale (hard flag) + scan competitor sul web

- **Stato:** Ready — decisioni prese con l'owner; implementato in `ideaChecker` con [ADR-0007](../adr/0007-duplicate-scan-llm-judge-web-search.md) in bozza (drafting delegato dall'owner, 2026-07-08; accettazione = owner, vedi [`adr-when-to-write.md`](../../../.claude/rules/adr-when-to-write.md)).
- **Data:** 2026-07-08
- **Branch:** `ideaChecker` (implementazione in branch dedicato; questo RFC non contiene codice).

## Context

Quando un membro crea una proposta, questa nasce in `nuova` (`proposals.status` default `'nuova'`, `0001`). Oggi non esiste alcun controllo di duplicazione: due persone possono inserire la stessa idea e nulla lo segnala. Inoltre non c'è nessun riscontro sul fatto che la feature esista già "nel mondo" (competitor).

**Obiettivo (richiesta owner 2026-07-08):** appena una proposta entra in `nuova`, far partire **due scansioni**:

1. **Scan locale (hard flag).** Confronta l'idea con le idee già presenti. Se ne trova una **molto simile o identica (≥ 85%)**, la proposta viene **segnalata** e **non può uscire da `nuova`** finché non viene *eliminata*, *spostata in `rifiutata`*, oppure *modificata in modo da differenziarla* (se la similarità scende sotto soglia si **sblocca**).
2. **Scan competitor sul web (informativo).** Ricerca sul web se la feature è già stata ideata/implementata da un prodotto competitor. Se sì, **non** flagga: scrive solo un blocchetto che descrive chi l'ha fatta e come, con i link alle fonti. La proposta resta spostabile.

Claude produce **un report scritto** (in fondo alla Proposal page) che unisce i due esiti: match locale (con link alla scheda dell'idea già esistente + autori) e match "nel mondo" (azienda/articolo + fonti). Se non trova nulla di simile in nessuno dei due casi, scrive semplicemente che non ci sono riscontri.

### Vincoli già esistenti (non decisioni di questo RFC)

- Transizioni di stato solo via RPC `move_proposal` (`0005`/`0006`), CAS su `from_status`, aperte a tutti i membri.
- Le colonne "privilegiate" di `proposals` sono scrivibili dai non-admin **solo** tramite RPC `SECURITY DEFINER` con GUC transaction-local letta dal trigger `enforce_proposal_privileged_columns` (`0003`/`0005`/`0010`) — esattamente il pattern di `move_proposal`.
- Autorizzazione DB-first (RLS) + guard ri-affermato nelle Server Action ([`layered-architecture.md`](../../../.claude/rules/layered-architecture.md)): **UI-hiding non è autorizzazione**, quindi il blocco "non esci da nuova se flaggata" vive **sia** nel service **sia** nella RPC.
- Provider AI = Anthropic (ADR-0003); client `anthropicClient()` è l'unico punto che legge `ANTHROPIC_API_KEY`, solo server. Pattern eval non-bloccante con `begin/apply/fail_ai_evaluation` (`0010`/`0011`) e trigger client fire-and-forget (`Board.tsx`).

## Decisioni prese con l'owner

- **Metodo similarità locale = LLM-as-judge** (non embeddings/pgvector). Si riusa il client Anthropic esistente: si passano a Claude le idee candidate (titolo + descrizione troncata) e la nuova idea, e Claude restituisce **l'unica idea più simile + un punteggio 0–100**. Motivazione: scala MVP (poche decine/centinaia di idee), nessuna nuova dipendenza né nuovo provider di embeddings, nessun nuovo secret. Il passaggio a pgvector è un follow-up se il volume cresce.
- **`web_search` server-side di Anthropic** per lo scan competitor (nessuna nuova API key: il tool è fatturato via API). Nota privacy da registrare in ADR: **il testo dell'idea esce verso l'indice di ricerca esterno**.
- **Due chiamate Claude separate** (non una sola con tool + structured output insieme): (1) scan locale con **structured output** JSON, nessun tool; (2) scan web con **`web_search`** e output testo/markdown. Tiene le due responsabilità semplici ed evita il dubbio di compatibilità tool+`output_config`.
- **Soglia 85% = business rule nel service** (costante TS), non hardcoded in SQL: il DB memorizza `dup_flagged` deciso dal service.
- **Trigger non-bloccante**, come per l'eval: la creazione resta istantanea; lo scan gira dopo, con cue di stato visibile (in corso / fallito + "Rilancia").

## Modello dati (nuova migration, owner-locked)

`supabase/migrations/00XX_duplicate_scan.sql`. Riusa l'enum `ai_eval_status` (`0010`) per lo stato dello scan (stessi 4 stati) — nessun nuovo tipo.

Nuove colonne su `proposals`:

| Colonna | Tipo | Uso |
|---|---|---|
| `dup_scan_status` | `ai_eval_status` not null default `'assente'` | cue UI (in corso / completato / fallito) |
| `dup_scan_error` | `text` | messaggio d'errore (troncato) |
| `dup_flagged` | `boolean` not null default `false` | **il gate**: letto da `move_proposal` |
| `dup_match_id` | `uuid references proposals(id) on delete set null` | idea locale più simile (link scheda) |
| `dup_similarity` | `int` | punteggio 0–100 del match locale (display) |
| `dup_report` | `text` | report scritto da Claude (markdown), locale + mondo |

Nuove RPC `SECURITY DEFINER` (pattern GUC, **non** admin-only — lo scan gira sulla propria idea in `nuova`; guard interno = proposer-or-admin, RLS/trigger come backstop):

- `begin_dup_scan(p_id uuid, p_force boolean) returns boolean` — set `dup_scan_status='in_corso'` + azzera errore; `false` se già `in_corso` (una sola in-flight) e non `force`; `force` recupera scan orfani di un crash (come `0011`).
- `apply_dup_scan(p_id uuid, p_flagged boolean, p_similarity int, p_match uuid, p_report text)` — set `completata` + i campi; il service passa `p_flagged` (soglia decisa in TS).
- `fail_dup_scan(p_id uuid, p_error text)` — set `fallita` + errore (non bloccante).

`revoke ... from public, anon; grant execute ... to authenticated`. Estendere `enforce_proposal_privileged_columns` per (a) coprire le nuove colonne come privilegiate e (b) riconoscere la GUC delle RPC di scan.

**Enforcement del blocco in `move_proposal` (backstop RLS):** una proposta `dup_flagged` non può passare da `nuova` a nulla **tranne** `rifiutata`. Nel corpo della RPC, prima del CAS:

```
if p_from = 'nuova' and p_to <> 'rifiutata'
   and (select dup_flagged from public.proposals where id = p_id) then
  raise exception 'proposta segnalata come possibile duplicato';
end if;
```

L'eliminazione è un percorso diverso (policy delete owner/admin), quindi resta sempre possibile anche se flaggata. `create or replace` preserva i grant di `0005`/`0006`.

## Architettura per layer

1. **Data** — `src/lib/ai/scanProposal.ts` (nuovo, puro-ish, client iniettato): le due chiamate Claude + validazione. `runProposalScan.ts` (nuovo, mirror di `runEvaluation.ts`): carica idea + candidati, `begin_dup_scan`, chiama `scanProposal`, assembla il report, `apply_dup_scan`; fallimento → `fail_dup_scan`, mai bloccante.
2. **Application service** — Server Action `runProposalScanAction(proposalId, force?)` in `src/app/proposals/actions.ts`: autentica, autorizza (proposer-or-admin), orchestra, mappa errori. Il blocco anti-move vive in `updateProposalStatus` (guard applicativo con messaggio chiaro) + `move_proposal` (backstop). La re-scansione su edit vive in `updateProposal` (`[id]/actions.ts`).
3. **Transport / trigger** — creazione: `createProposal` inserisce e **reindirizza a `/proposals/{id}`** (oggi reindirizza a `/`); un piccolo client `ProposalScanTrigger` sul dettaglio fa fire-and-forget di `runProposalScanAction(id)` quando `dup_scan_status === 'assente'` (mirror del fire-and-forget di `Board.tsx`); il `refresh()` interno aggiorna il pannello. Edit in `nuova` con testo cambiato: `updateProposal` chiama (await) `runProposalScan(force)` per ricalcolare/sbloccare.

### Candidati per lo scan locale

`select id, title, description from proposals where id <> p_id and status <> 'rifiutata' order by created_at desc limit N` (N ≈ 100). LLM-judge su ≤ N candidati; se i candidati superano N, `log()`/nota del troncamento (nessun cap silenzioso). Follow-up: pre-filtro `pg_trgm`/pgvector se il volume cresce.

## Le due chiamate a Claude

**(1) Scan locale — structured output, nessun tool.** Modello `claude-opus-4-8`. Input: la nuova idea (title/description/problem) + elenco candidati (`id`, `title`, `description` troncata). Output schema `{ mostSimilarId: string | null, similarity: number, localSummary: string }`. Il system prompt marca candidati e idea come materiale non fidato (anti-prompt-injection, come `evaluateProposal`). In TS: `flagged = similarity >= DUP_THRESHOLD (85)`; `mostSimilarId` validato contro l'insieme dei candidati (mai fidarsi di un id inventato) → `dup_match_id`.

**(2) Scan web — `web_search`, output markdown.** Tool GA `web_search` (identificatore esatto e forma da verificare a implementazione con lo skill `claude-api` e i docs SDK; nel repo è installato `@anthropic-ai/sdk` con `web_search_20250305` GA). Prompt: "questa feature esiste già in un prodotto competitor? Se sì, chi e come, con URL delle fonti; altrimenti dillo esplicitamente." L'output è prosa markdown con i link delle citazioni reali di `web_search`.

**Assemblaggio report (`dup_report`).** Un paragrafo che unisce `localSummary` + prosa web, oppure "Nessun riscontro simile trovato" se entrambi vuoti. **I link/autori interni NON li scrive Claude** (rischio hallucination di URL): la scheda dell'idea locale e il proposer si **renderizzano dai dati** (embed `dup_match:proposals!dup_match_id(id, title, proposer:profiles(name,email))`), authoritative. Claude fornisce la prosa di similarità e i link web (citazioni reali).

## UI

- **`ProposalPanel`** — nuova sezione in fondo "Scansione simili": cue di stato (riuso `EvalStatusCue`, stesso enum), e:
  - se `dup_flagged`: box di avviso "⚠️ Possibile duplicato (NN% simile a «Titolo»)" con `<Link href="/proposals/{dup_match_id}">` + proposer, e la nota "non può uscire da Nuova finché non la modifichi o la sposti in Rifiutata".
  - il `dup_report` (markdown) con i riscontri locale + mondo, o "nessun riscontro".
  - se `fallita`: messaggio + "Rilancia scansione" (mirror `RetryEvaluationButton`, ma non admin-only: proposer-or-admin).
- **`ProposalCard`** (board): piccola cue `dup_scan_status` + badge "duplicato" se `dup_flagged`. Minimale.
- **`updateProposalStatus` errore** mappato a un messaggio chiaro quando il move è rifiutato dal flag.

Estendere `ProposalListItem`/`ProposalDetail` + `listProposals`/`getProposalDetail` con i campi `dup_*` (e l'embed `dup_match`).

## Limiti / costi

- 2 chiamate Claude + 1 `web_search` per scan (`web_search` ha costo per ricerca). Cap candidati (N ≈ 100), timeout ~30s, una sola scan in-flight per proposta.
- `AI_SCAN_FAKE=1` per girare in demo senza crediti (mirror `AI_EVAL_FAKE`): stub deterministico (nessun match, report placeholder).
- Trigger-on-view per la creazione: lo scan parte quando il creatore apre il dettaglio (dove viene reindirizzato). Se abbandona a metà, `dup_scan_status` resta `in_corso` → "Rilancia" con `force` recupera (come i crash orfani di `0011`).
- Nessuna nuova env var (riuso `ANTHROPIC_API_KEY`; `web_search` non richiede chiavi extra).

## File da creare / modificare

| Azione | File |
|---|---|
| Service scan (2 chiamate Claude + validazione) | `src/lib/ai/scanProposal.ts` (nuovo) |
| Orchestrazione non-bloccante (begin/apply/fail) | `src/lib/ai/runProposalScan.ts` (nuovo) |
| Server Action `runProposalScanAction` + guard anti-move | `src/app/proposals/actions.ts` (mod) |
| Redirect create → dettaglio | `src/app/proposals/new/actions.ts` (mod) |
| Client trigger fire-and-forget on-view | `src/components/detail/ProposalScanTrigger.tsx` (nuovo) |
| Re-scan su edit in `nuova` | `src/app/proposals/[id]/actions.ts` (mod) |
| Tipi `dup_*` + embed nelle query | `src/lib/proposals.ts` (mod) |
| Sezione "Scansione simili" + badge | `src/components/detail/ProposalPanel.tsx`, `src/components/cards/ProposalCard.tsx` (mod) |
| Bottone "Rilancia scansione" (proposer-or-admin) | riuso/estensione di `RetryEvaluationButton` o nuovo gemello |
| Migration colonne + RPC + `move_proposal` esteso | `supabase/migrations/00XX_duplicate_scan.sql` (nuovo, **owner**) |

Riuso: `anthropicClient()`, pattern `runEvaluation` (begin/apply/fail, `force`, non-bloccante), GUC di `move_proposal`, `EvalStatusCue`, `RetryEvaluationButton`, `getProfile`, `refresh()`, il fire-and-forget di `Board.tsx`, `AI_EVAL_FAKE`→`AI_SCAN_FAKE`.

## ADR correlata (autoria/accettazione owner)

- **ADR-0007** — Estensione dell'uso di Anthropic: nuovo percorso di scan anti-duplicato (LLM-as-judge) + capability `web_search` per lo scan competitor (con la nota privacy: egress del testo idea verso la ricerca web).

## Consequences

**Positive:** riusa interamente il pattern eval (RPC definer + GUC, trigger non-bloccante, cue di stato) e i componenti UI esistenti; nessuna nuova dipendenza né secret (LLM-judge, non embeddings); il blocco anti-duplicato è enforced a due livelli (service + `move_proposal`) come impone `layered-architecture.md`; single source of truth per il flag (`dup_flagged`, scritto solo dalle RPC).

**Negative:** costo per scan (2 Claude + web_search), mitigato da cap candidati e una-in-flight; LLM-judge meno preciso/scalabile di embeddings (follow-up pgvector se serve); trigger-on-view per la creazione (scan orfano se si abbandona, recuperabile con "Rilancia"); egress del testo idea verso la ricerca web (accettato, da registrare in ADR).

## Source

Richiesta owner (2026-07-08): controllo duplicati locale con hard flag + ricerca web competitor con report scritto da Claude in fondo alla Proposal page. Metodo similarità e percorso RFC-first decisi in sessione con l'owner. Dettagli API Claude/`web_search` da verificare a implementazione con lo skill `claude-api` e i docs SDK ([`AGENTS.md`](../../../AGENTS.md)).
