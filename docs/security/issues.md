**Last updated:** 2026-07-01

# Security Issues

Open-issues registry for the security review flow (`Software Reviewer` → `Review Reviewer` → `Security Expert`, see [`README.md`](README.md)). Each finding lives under its severity section with a stable ID; resolved entries are marked `✅ resolved (YYYY-MM-DD)` and may be deleted by hand once no longer useful. **Issue IDs are never renumbered or reused.**

## 🔴 HIGH

- **SEC-2** ✅ resolved (2026-07-01) — Privilege escalation su `profiles`: la policy "self update" (`supabase/migrations/0001_init.sql:83`) non aveva `WITH CHECK` né column privilege, quindi un contributor autenticato poteva settarsi `role='admin'` via PostgREST diretto con l'anon key. Risolto da `supabase/migrations/0003_lock_privileged_columns.sql` (revoke + `grant update (name)`), applicata dall'owner al database il 2026-07-01. Dettagli in [`README.md`](README.md#sec-2).

## 🟠 MEDIUM

- **SEC-3** ✅ resolved (2026-07-01) — Colonne privilegiate di `proposals` scrivibili dal proprietario: la policy "owner or admin update" (`supabase/migrations/0001_init.sql:93-95`) permetteva al proprietario di cambiare `status`, `proposer_id`, campi `ai_*`, `internal_notes` via PostgREST (e di impostarli alla creazione via INSERT). Risolto da `supabase/migrations/0003_lock_privileged_columns.sql` (trigger before insert/update), applicata dall'owner al database il 2026-07-01. Dettagli in [`README.md`](README.md#sec-3).

## 🟡 LOW

- **SEC-1** — User enumeration via verbatim OTP error message on `/login`. `signInWithOtp({ shouldCreateUser: false })` returns a distinguishable error for unregistered emails, surfaced verbatim in the `role="alert"`. An unauthenticated visitor can probe which emails are registered. Low impact for an invite-only internal tool; details in [`README.md`](README.md#sec-1).
