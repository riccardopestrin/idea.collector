**Last updated:** 2026-07-05

# Security Issues

Open-issues registry for the security review flow (`Software Reviewer` → `Review Reviewer` → `Security Expert`, see [`README.md`](README.md)). Each finding lives under its severity section with a stable ID; resolved entries are marked `✅ resolved (YYYY-MM-DD)` and may be deleted by hand once no longer useful. **Issue IDs are never renumbered or reused.**

## 🔴 HIGH

- **SEC-2** ✅ resolved (2026-07-01) — Privilege escalation su `profiles`: la policy "self update" (`supabase/migrations/0001_init.sql:83`) non aveva `WITH CHECK` né column privilege, quindi un contributor autenticato poteva settarsi `role='admin'` via PostgREST diretto con l'anon key. Risolto da `supabase/migrations/0003_lock_privileged_columns.sql` (revoke + `grant update (name)`), applicata dall'owner al database il 2026-07-01. Dettagli in [`README.md`](README.md#sec-2).

## 🟠 MEDIUM

- **SEC-3** ✅ resolved (2026-07-01) — Colonne privilegiate di `proposals` scrivibili dal proprietario: la policy "owner or admin update" (`supabase/migrations/0001_init.sql:93-95`) permetteva al proprietario di cambiare `status`, `proposer_id`, campi `ai_*`, `internal_notes` via PostgREST (e di impostarli alla creazione via INSERT). Risolto da `supabase/migrations/0003_lock_privileged_columns.sql` (trigger before insert/update), applicata dall'owner al database il 2026-07-01. Dettagli in [`README.md`](README.md#sec-3).

## 🟡 LOW

- **SEC-1** — User enumeration via verbatim OTP error message on `/login`. `signInWithOtp({ shouldCreateUser: false })` returns a distinguishable error for unregistered emails, surfaced verbatim in the `role="alert"`. An unauthenticated visitor can probe which emails are registered. Low impact for an invite-only internal tool; details in [`README.md`](README.md#sec-1).
- **SEC-5** — `profiles.name` senza vincolo di lunghezza a DB: il cap di 80 caratteri vive solo nella Server Action `updateName` (`src/app/profile/actions.ts`), ma la grant di colonna di `0003_lock_privileged_columns.sql` permette a un utente autenticato di aggiornare `name` sulla propria riga via PostgREST diretto, bypassando il cap (stringa arbitrariamente lunga). Niente escalation (RLS self-scoped, render JSX-escaped); solo storage/UI abuse. Fix pronto in `supabase/migrations/0008_profiles_name_length_check.sql` — in attesa di apply al database da parte dell'owner. Dettagli in [`README.md`](README.md#sec-5).
- **SEC-6** — `ai_eval_error` visibile in chiaro a tutti gli utenti autenticati: `fail_ai_evaluation` (migration 0010) salva il messaggio d'errore grezzo (Anthropic SDK, GitHub API, config) e `getProposalDetail` lo espone a chiunque apra il pannello, non solo agli admin che possono agire sul retry. Possibile disclosure di dettagli interni (endpoint, request-id, hint di configurazione). Nessuna escalation; render JSX-escaped e troncato a 500 char. Dettagli in [`README.md`](README.md#sec-6).
- **SEC-7** — Voto RICE utente non anonimo: `getProposalDetail` embedda `voter:profiles(name, email)` e `ProposalPanel` mostra `personLabel(vote.voter)` (fallback all'email) accanto al punteggio individuale, con RLS select `using (true)` su `rice_votes`. Ogni membro autenticato vede chi ha votato e il suo score. Stesso pattern `name ?? email` già usato per proposer/author/history — non è una nuova classe di esposizione; tool interno invite-only, voto non-anonimo scelta di design deliberata (commento migration 0015). Nessuna escalation, render JSX-escaped. Dettagli in [`README.md`](README.md#sec-7).
- **SEC-4** — Known-vulnerable transitive dependency: `postcss < 8.5.10` via `next` (GHSA-qx2v-qp2m-jg93, moderate — XSS via unescaped `</style>` in CSS stringify output). Not exploitable here (build-time tooling, no untrusted CSS is stringified), but it keeps `pnpm audit --prod` red. Details in [`README.md`](README.md#sec-4).
