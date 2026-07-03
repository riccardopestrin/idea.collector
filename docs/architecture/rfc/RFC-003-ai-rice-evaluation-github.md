# RFC-003: Valutazione RICE automatica con Claude sul contesto del repo

- **Stato:** Ready — decisioni prese con l'owner; pronto per conversione in ADR-0003 (Anthropic) e ADR-0004 (GitHub App). Autoria/accettazione ADR = owner (vedi [`adr-when-to-write.md`](../../../.claude/rules/adr-when-to-write.md)).
- **Data:** 2026-07-03
- **Branch:** implementazione in branch dedicato (TBD); questo RFC + le due ADR non contengono codice.

## Context

Nel DB i campi di scoring (`reach`, `impact`, `confidence`, `effort`, `ai_rationale`, `ai_generated`, `manually_edited`, `method`) **esistono già** (`supabase/migrations/0001_init.sql`) ma **nessun codice li calcola o li scrive**: sono solo mostrati in [`src/components/detail/ProposalPanel.tsx`](../../../src/components/detail/ProposalPanel.tsx) e bloccati alle scritture non-admin dal trigger `enforce_proposal_privileged_columns` (`0003`/`0005`). Non esiste alcun concetto di "progetto", nessuna integrazione esterna (solo Supabase), e `links` è un `text[]` non strutturato.

**Obiettivo:** quando un **admin** sposta una proposta in `in_valutazione`, Claude produce una valutazione RICE (i quattro componenti + una spiegazione) confrontando il testo dell'idea con il **contesto del repository GitHub del progetto**. Un solo repo globale, collegato da UI; multi-progetto/multi-bacheca in futuro.

### Vincoli già esistenti (non decisioni di questo RFC)

- `proposals.status` con default `'nuova'`; transizioni via RPC `move_proposal` (`0005`), aperte a tutti i membri (rettifica ADR-0002).
- Le colonne di scoring sono **admin-only** via trigger (`0003`/`0005`): l'unico modo pulito per scriverle da un percorso non-admin è una RPC `SECURITY DEFINER` con GUC, come fa già `move_proposal`.
- Autorizzazione DB-first (RLS) + guard ri-affermato nelle Server Action ([`layered-architecture.md`](../../../.claude/rules/layered-architecture.md)).
- Secret solo in `.env.local` ([`host-machine-safety.md`](../../../.claude/rules/host-machine-safety.md)); `supabase/migrations/` e `docs/architecture/adr/` sono owner-locked ([`change-control.md`](../../../.claude/rules/change-control.md)).

## Decisioni prese con l'owner

- **Contesto repo via una singola chiamata Messages API** (no Managed Agents), con un digest del repo abbastanza ricco da valutare bene.
- **Trigger: solo il move di un admin** in `in_valutazione` innesca la valutazione.
- **Single global repo config** per v1 (multi-progetto in futuro), **collegabile da UI** dall'area profilo.
- **Collegamento GitHub via GitHub App** ("Connetti GitHub" → **autorizzi** l'App sulla repo scelta, anche privata, in **sola lettura**). La GitHub App **non** è un programma da scaricare (≠ GitHub Desktop / `gh`): è un'integrazione su github.com; "autorizzarla" = concederle accesso alla repo dal sito, nel browser. Un "repo" **non** può essere una cartella locale: il codice gira sul server, l'accesso è via API GitHub. Vantaggi vs OAuth App: accesso **granulare alla sola repo scelta**; token di lettura **generati al volo dalla private key e a scadenza ~1h** → **nessun token longevo nel DB**.
- **UI status della valutazione** su scheda piccola (dashboard) e ingrandita: rotella "sta valutando", pallino rosso = fallita, pallino verde/azzurro = completata; tasto "Rilancia" quando è fallita.
- **Esperienza seamless**: valutazione asincrona (il move resta istantaneo) con limiti concreti (sotto).
- **Display a mo' di statistica**: **voto totale** (RICE composito) più il valore di **ogni componente**.

## Architettura per layer

1. **Config** — `.env.local` (owner): `ANTHROPIC_API_KEY`, `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY` (PEM), `GITHUB_APP_CLIENT_ID`, `GITHUB_APP_CLIENT_SECRET`, `GITHUB_APP_CALLBACK_URL`. Placeholder in `.env.example`. Letti solo lato server. Nessun token longevo nel DB.
2. **Data / integrazione** — `src/lib/github/app.ts` (JWT firmato con la private key → token di accesso alla repo ~1h, list repo autorizzate), `src/lib/github/repoDigest.ts` (digest via GitHub REST), `src/lib/ai/anthropic.ts` (factory client Anthropic).
3. **Application service** — `src/lib/ai/evaluateProposal.ts`: costruisce il prompt, chiama Claude con structured outputs, valida/clampa il JSON per `method`, ritorna `{reach, impact, confidence, effort, rationale}`. Riceve client e digest già pronti (nessun secret letto qui).
4. **Transport** — Server Actions:
   - `evaluateProposal(proposalId)` (`src/app/proposals/actions.ts`): autentica, **autorizza admin-only**, orchestra digest→Claude→persistenza, mappa errori. Usata da auto-trigger e da "Rilancia".
   - `updateProposalStatus`: invariata; dopo un move admin in `in_valutazione` il client chiama `evaluateProposal`.
   - `startGithubConnect` / `selectRepo` / `disconnectGithub` (`src/app/profile/actions.ts`): admin-only.
5. **Persistenza + RLS** — RPC `SECURITY DEFINER` (pattern GUC di `move_proposal`, `0005`) come unico seam fidato per scrivere le colonne AI (altrimenti admin-locked): `begin_ai_evaluation`, `apply_ai_evaluation`, `fail_ai_evaluation`.

## Stato della valutazione (per la UI cue)

Nuova colonna su `proposals`: `ai_eval_status` enum `{'assente','in_corso','completata','fallita'}` (default `'assente'`) + `ai_eval_error text`.

- `in_corso` → rotella; `completata` → pallino verde/azzurro; `fallita` → pallino rosso + tasto **"Rilancia valutazione"** (admin-only); `assente` → nessun indicatore.
- Scritte solo dalle RPC definer: `begin_ai_evaluation`→`in_corso`, `apply_ai_evaluation`→`completata` (+scores), `fail_ai_evaluation`→`fallita` (+errore).

## Flusso runtime (move e valutazione disaccoppiati)

1. Admin sposta in `in_valutazione` → `updateProposalStatus` → `move_proposal` (ritorna subito).
2. Al successo, se admin, il client chiama `evaluateProposal`; la card mostra la rotella.
3. `evaluateProposal`: `begin_ai_evaluation` → carica proposta + repo config → `repoDigest` (cache) → Claude → validazione → `apply_ai_evaluation` → `refresh()`.
4. Fallimento (GitHub giù, refusal/rate-limit/timeout, JSON invalido): `fail_ai_evaluation` → `fallita` + errore; **non** blocca il move; card mostra rosso + "Rilancia".
5. "Rilancia" richiama `evaluateProposal`.

## Digest del repo — "capire bene il contesto"

`repoDigest.ts` fa poche chiamate REST (Bearer del token di accesso) e compone un blocco compatto e **deterministico**:

- `GET /repos/{o}/{r}` (description, topics, linguaggio, default branch, open issues)
- `GET /repos/{o}/{r}/languages`
- `GET /repos/{o}/{r}/readme` (base64→decode, troncato ~N KB)
- `GET /repos/{o}/{r}/git/trees/{branch}?recursive=1` (albero, troncato ~M path)
- `GET /repos/{o}/{r}/commits?per_page=20`
- `package.json` se presente

Il digest è stabile tra proposte diverse (stesso repo) → prefisso con `cache_control: {type:"ephemeral", ttl:"1h"}` (prompt caching); testo proposta = suffisso volatile. Inoltre cache in-memory server-side (TTL ~10 min) per non ricolpire GitHub ad ogni valutazione.

## Chiamata a Claude

- SDK `@anthropic-ai/sdk` (nuova dipendenza, coperta da ADR-0003). Modello `claude-opus-4-8`, `thinking: {type:"adaptive"}`.
- **Structured outputs** (`output_config.format`, `json_schema`) → `{reach,impact,confidence,effort,rationale}`; `client.messages.parse()`.
- System prompt: definisce RICE, unità e range per `method` (RICE: `confidence`∈0..1, `effort`>0; ICE: 1..10) e istruisce a fondare la stima sul digest oltre che sul testo dell'idea.
- Post-validazione nel service: clamp/whitelist range per `method`; gestire `stop_reason==="refusal"` prima di leggere `content`.

## Punteggio RICE — display a statistica (in v1)

Il senso di RICE è ridurre i quattro numeri a **un punteggio unico di priorità**: `(Reach × Impact × Confidence) / Effort` (ICE: `Impact × Confidence × Ease`). Oggi l'app mostra i componenti separati e non li combina mai.

In v1 lo scoring si mostra **a statistica**: un **voto totale** in evidenza (il composito) più il valore di **ogni componente**.

- Composito calcolato **in TypeScript** (`computeRiceScore(detail)` in `src/lib/proposals.ts`, rispetta `method`), **non** colonna DB → nessuna migration, sempre coerente con i componenti.
- Edge: `effort` 0/assente → "—" (no divisione per zero); se un componente è `null`, il totale non si mostra.
- Voto totale come badge sulla scheda piccola; breakdown completo nel `ProposalPanel`.
- Ordinamento board per punteggio: follow-up separato.

## Limiti per un'esperienza seamless

- Move mai bloccante (valutazione asincrona).
- Una sola valutazione in-flight per proposta (`begin_ai_evaluation` short-circuita se già `in_corso`).
- Idempotenza: se `ai_generated=true` e non `manually_edited`, l'auto-trigger salta (il "Rilancia" manuale forza).
- Timeout Claude (~30s) → `fallita` con "timeout".
- Prompt caching + cache digest server-side per costi/latenza.
- Token di accesso (rate limit ~5000 req/h per autorizzazione) + digest compatto + cache; token cachato finché valido (~1h); autorizzazione revocata → "riconnetti".
- `max_tokens` contenuto (output = JSON piccolo).

## Collega GitHub + scegli la repo (area profilo)

> **Terminologia.** La GitHub App non è un programma da installare sul PC. "Autorizzarla" (GitHub la chiama tecnicamente *install*) = dal sito github.com concederle accesso in sola lettura alla repo scelta, nel browser. Il numero restituito è l'`installation_id` (identificativo dell'autorizzazione, **non un secret**).

Flusso, nell'area profilo esistente (`src/app/profile/`), visibile solo agli admin:

1. **Autorizza** — "Connetti GitHub" → su github.com scegli la repo (anche privata), sola lettura, conferma → callback `src/app/auth/github/callback/route.ts` con `installation_id`.
2. **Salva** — la route salva `installation_id`.
3. **Scegli la repo** — se l'autorizzazione copre più repo, la UI le elenca e l'admin ne seleziona una → `owner/name` in `app_settings`.
4. `evaluateProposal` genera al volo il token e legge il repo; se manca autorizzazione/repo → errore "collega GitHub e scegli la repo nel profilo".

Persistenza: `app_settings` (riga singola) con `github_installation_id`, `github_owner`, `github_repo`, `updated_by/at`. **Nessun secret in DB** (private key in env). Lettura `authenticated`, scrittura admin.

**Sviluppo locale:** funziona senza tunnel — il callback è un redirect del browser (GitHub accetta `http://localhost:3000/auth/github/callback`) e le chiamate API partono in uscita dal server locale; niente webhook. Una App supporta **più callback URL** → si registrano insieme localhost + produzione con una sola App; callback via env per non hardcodare l'host. Permessi *Contents/Metadata: Read* → nessuna ri-approvazione al deploy.

## Migration (owner-locked)

`supabase/migrations/00XX_ai_evaluation.sql`:
- enum `ai_eval_status` + colonne `ai_eval_status`/`ai_eval_error` su `proposals`.
- tabella `app_settings` (riga singola) + RLS (read authenticated, write admin). Nessun secret.
- RPC `SECURITY DEFINER` `begin_ai_evaluation`/`apply_ai_evaluation`/`fail_ai_evaluation`: check `auth.uid()` + ruolo admin, GUC transaction-local letta dal trigger, scrivono solo le colonne AI/stato; `revoke ... from public,anon; grant execute ... to authenticated`.
- Estendere `enforce_proposal_privileged_columns` per riconoscere la GUC delle RPC AI e coprire le nuove colonne.

## File da creare / modificare

| Azione | File |
|---|---|
| Wrapper client Anthropic | `src/lib/ai/anthropic.ts` (nuovo) |
| GitHub App (JWT→token, list repo) | `src/lib/github/app.ts` (nuovo) |
| Digest repo + cache | `src/lib/github/repoDigest.ts` (nuovo) |
| Service di valutazione | `src/lib/ai/evaluateProposal.ts` (nuovo) |
| Route callback autorizzazione GitHub App | `src/app/auth/github/callback/route.ts` (nuovo) |
| Server Action `evaluateProposal` (admin-only) | `src/app/proposals/actions.ts` (mod) |
| Server Actions `startGithubConnect`/`selectRepo`/`disconnectGithub` | `src/app/profile/actions.ts` (mod) |
| Sezione "Repository progetto" (connetti + picker, admin) | `src/app/profile/page.tsx` (mod) |
| `computeRiceScore` + tipi (`ai_eval_status`) | `src/lib/proposals.ts` (mod) |
| Migration RPC + enum stato + `app_settings` | `supabase/migrations/00XX_ai_evaluation.sql` (nuovo, owner) |
| Blocco statistica + cue stato + "Rilancia" | `src/components/detail/ProposalPanel.tsx` (mod) |
| Badge voto totale + cue stato + "Rilancia" (scheda piccola) | `src/components/cards/*` (mod) |
| Env vars documentate | `.env.example` (mod) |
| Dipendenza SDK | `package.json` (`pnpm add @anthropic-ai/sdk`) |

Riuso: `move_proposal`/GUC come modello per le RPC; `getProfile` per il check admin; `supabaseServer()`; pattern Server Action + `refresh()`; `ProposalPanel` (già mostra scores + `ai_rationale`); `listProposals`/`getProposalDetail` estesi con `ai_eval_status`.

## ADR correlate (autoria/accettazione owner)

- **ADR-0003** — Anthropic come provider di scoring AI.
- **ADR-0004** — Integrazione GitHub via GitHub App per contesto progetto.

## Consequences

**Positive:** riusa i campi di scoring e il `ProposalPanel` già esistenti; l'unico seam privilegiato (RPC definer) segue un pattern già in repo; superficie di sicurezza contenuta (nessun token longevo nel DB, private key in env, accesso granulare a una repo read-only); UX seamless (valutazione asincrona, stato visibile, rilancio). Contesto repo ricco → valutazioni migliori.

**Negative:** due nuove dipendenze esterne (Anthropic, GitHub) con lock-in e costi per valutazione (mitigati da caching); nuova superficie da presidiare (custodia private key, validazione callback, RLS su `app_settings`, RPC AI); registrazione one-time della GitHub App a carico dell'owner; multi-progetto rimandato.

## Source

Richiesta dell'owner (2026-07-03): valutazione RICE automatica confrontando l'idea con il repo del progetto collegato. Decisioni di scoping raccolte in sessione di planning; dettagli API Claude dalla reference dello skill `claude-api`.
