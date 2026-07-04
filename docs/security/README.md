**Last updated:** 2026-07-04

# Security Review

This is the actionable guide for the lightweight security flow. Every coding task that touches source under `src/` or `supabase/migrations/` runs:

1. **Software Reviewer** — first-pass code review, returns structured findings.
2. **Review Reviewer** — filters false positives, returns a filtered action list.
3. **Security Expert** — reviews the change against the vulnerability classes below and records findings in [`issues.md`](issues.md).

Open issues live in [`issues.md`](issues.md); consciously-deferred NICE-TO-HAVE items live in [`be-careful.md`](be-careful.md). Any open **HIGH** issue must be surfaced to the user (see [`.claude/rules/security-warning.md`](../../.claude/rules/security-warning.md)).

## Vulnerability classes to watch for (this stack)

This is a Next.js 16 + Supabase internal dashboard. The classes that matter here:

- **Supabase RLS gaps / BOLA** — a table or query reachable without a Row-Level-Security policy, or a policy that lets a `contributor` read/write rows belonging to others. Authorization is RLS + the role on `profiles`; verify every new table has policies and every query is scoped to the actor.
- **Server Action authorization** — mutations are Server Actions. Each one must re-check the authenticated user and role server-side; never trust client-passed identity or role.
- **Secret / key exposure** — service-role keys, Supabase secrets, and the Claude/AI API key must stay server-only. A secret leaked through a `NEXT_PUBLIC_*` env var, a client component, or a response body is a finding. `NEXT_PUBLIC_*` is shipped to the browser — only truly public values belong there.
- **AI prompt injection** — the Claude-powered RICE-scoring feature feeds user-submitted proposal text into a prompt. Treat that text as untrusted: it must not be able to exfiltrate data, override instructions, or trigger unintended actions. Validate/scope what the model can return and act on.
- **XSS** — any use of `dangerouslySetInnerHTML` (or equivalent raw-HTML rendering) with user/AI-derived content. Prefer escaped rendering; if raw HTML is unavoidable, sanitize.
- **SSRF** — if the AI feature (or any server code) fetches a user-supplied URL/link, an attacker can target internal addresses. Validate and allowlist outbound destinations.

## Findings

_SEC-2 e SEC-3 (RLS su `profiles`/`proposals`) risolte il 2026-07-01 da `0003_lock_privileged_columns.sql` — vedi [`issues.md`](issues.md)._

### SEC-1 — User enumeration via verbatim OTP error (LOW)

**Where:** [`src/app/login/page.tsx`](../../src/app/login/page.tsx) — `sendCode()` shows `error.message` verbatim in the `role="alert"`.

**Issue:** With `shouldCreateUser: false`, Supabase returns a distinguishable error when the email is not a registered user. Rendering that message verbatim lets an unauthenticated visitor tell registered emails apart from unregistered ones (account enumeration).

**Impact:** Low. Access is invite-only and internal; enumeration only reveals which addresses are members, not credentials. No account takeover.

**Fix when touched:** Show a generic, non-distinguishing confirmation after `sendCode()` (e.g. "Se l'indirizzo è abilitato, riceverai un codice") regardless of the Supabase result, and only surface real errors for the verify step. Supabase's server-side rate limiting already throttles brute-force probing.

### SEC-5 — No DB length constraint on `profiles.name` (LOW)

**Where:** [`src/app/profile/actions.ts`](../../src/app/profile/actions.ts) (app-side 80-char cap) vs. `supabase/migrations/0003_lock_privileged_columns.sql` (column grant on `name` with no `CHECK`).

**Issue:** The 80-character limit is enforced only in the `updateName` Server Action. The column grant that fixed SEC-2 intentionally allows authenticated users to update `name` on their own row via direct PostgREST, so the app-side cap can be bypassed with an arbitrarily long string.

**Impact:** Low. RLS keeps the write self-scoped and the name is rendered via JSX (auto-escaped), so the worst case is a user storing an oversized name that degrades their own header/proposal-card display and wastes storage. No cross-user or privilege impact.

**Fix:** migration ready in [`supabase/migrations/0008_profiles_name_length_check.sql`](../../supabase/migrations/0008_profiles_name_length_check.sql) (`CHECK (char_length(name) <= 80)`; a NULL name passes the check). Awaiting owner apply to the database.

### SEC-6 — `ai_eval_error` grezzo esposto a tutti gli autenticati (LOW)

**Where:** `supabase/migrations/0010_ai_evaluation.sql` (`fail_ai_evaluation` salva `p_error` verbatim, troncato a 500), [`src/app/proposals/actions.ts`](../../src/app/proposals/actions.ts) (`evaluateProposal` passa `err.message` grezzo), [`src/components/detail/ProposalPanel.tsx`](../../src/components/detail/ProposalPanel.tsx) (render a ogni utente autenticato).

**Issue:** Il messaggio d'errore della valutazione AI (errori Anthropic SDK, status GitHub API, messaggi PostgREST, hint di configurazione tipo "manca la repo nel profilo") viene persistito in `proposals.ai_eval_error` e mostrato nel pannello a chiunque, contributor inclusi — non solo agli admin che possono agire sul retry.

**Impact:** Low. Tool interno, utenti fidati; il contenuto è JSX-escaped (no XSS) e troncato a 500 char. Il rischio residuo è disclosure di dettagli interni (endpoint, request-id, stato config) a ruoli che non ne hanno bisogno.

**Fix when touched:** In `evaluateProposal`, mappare gli errori a categorie stabili user-safe (es. "errore GitHub", "errore modello", "configurazione mancante") prima di chiamare `fail_ai_evaluation`, e/o mostrare `ai_eval_error` nel pannello solo quando `isAdmin`.

### SEC-4 — Vulnerable transitive `postcss` via `next` (LOW)

**Where:** `pnpm-lock.yaml` — dependency path `.>next>postcss` (`postcss < 8.5.10`).

**Issue:** GHSA-qx2v-qp2m-jg93 (moderate): PostCSS's CSS stringifier does not escape `</style>`, enabling XSS when untrusted CSS is stringified into HTML.

**Impact:** Low. In this app PostCSS runs only at build time on our own Tailwind CSS — no untrusted CSS ever reaches the stringifier. The residual cost is a permanently red `pnpm audit --prod`, which masks future real advisories.

**Fix when touched:** Bump `next` once it ships with `postcss >= 8.5.10`, or add a pnpm override (`"pnpm": { "overrides": { "postcss": ">=8.5.10" } }`) and verify the build.
