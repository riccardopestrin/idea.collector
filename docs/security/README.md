**Last updated:** 2026-07-08

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

### SEC-7 — Voter email exposed via `rice_votes` voter embed (LOW)

**Where:** [`src/lib/proposals.ts`](../../src/lib/proposals.ts) `getProposalDetail` (`votes:rice_votes(... voter:profiles(name, email))`), [`src/components/detail/ProposalPanel.tsx`](../../src/components/detail/ProposalPanel.tsx) (`personLabel(vote.voter)` in the "Voti utenti" list), migration [`0015_rice_votes.sql`](../../supabase/migrations/0015_rice_votes.sql) (`"auth read" ... using (true)`).

**Issue:** The user-vote list embeds each voter's `profiles(name, email)` and renders `personLabel`, which falls back to the raw **email** when `name` is null. Combined with the per-voter score, this makes voting **non-anonymous**: any authenticated member sees who voted and their individual RICE score. The email fallback is the same `name ?? email` pattern already used across the app for `proposer`, comment `author`, and `status_history.author`, so this is not a new exposure *class* — it applies the existing pattern to a new relation.

**Impact:** Low. Invite-only internal tool where members already see each other's proposer/author emails on every card and comment; the RLS `select` is intentionally open to all authenticated members ("la lista votanti è visibile nel pannello"). Non-anonymous voting is a deliberate product decision, not a leak. Residual risk is only that individual voters and their scores are attributable — which could bias voting or be undesirable if votes are ever meant to be private.

**Fix when touched:** If votes should be anonymous, stop embedding `voter:profiles` in `getProposalDetail` and render aggregate/anonymous rows only (the composite average already needs no per-voter identity). If attribution stays but email should not, embed `name` only and label unnamed voters generically. No change needed while non-anonymous voting is intended.

### SEC-8 — AI-score forging via `apply_ai_evaluation` diretta, senza validazione DB-side (LOW)

**Where:** `supabase/migrations/0013_author_edit_reevaluation_crystallization.sql` (`apply_ai_evaluation` — parametri `numeric`/`text` senza validazione, colonne `proposals.reach/impact/confidence/effort` senza `CHECK`), `supabase/migrations/0016_comment_promotion.sql` (`can_run_ai_evaluation` allargata agli autori di contributi `accepted`), [`src/lib/ai/evaluateProposal.ts`](../../src/lib/ai/evaluateProposal.ts) (`validateScores` — clamp 1–10 e truncate rationale solo in TS).

**Issue:** Le RPC `begin/apply/fail_ai_evaluation` sono granted a `authenticated` con `can_run_ai_evaluation` come unico gate. Dal 0013 il proposer di una proposta `in_valutazione`, e dal 0016 anche l'autore di un contributo `accepted` su di essa, possono chiamare `apply_ai_evaluation` direttamente via PostgREST con l'anon key: la RPC scrive `reach/impact/confidence/effort/ai_rationale` senza alcun range check (qualsiasi `numeric`, anche negativo o fuori scala — un valore enorme o un prodotto negativo corrompe la media geometrica e il ranking in board) e senza limite di lunghezza sulla rationale. Il clamp 1–10 intero e il truncate a 2000 char esistono solo nel service TS, che una chiamata diretta bypassa. Un co-autore può quindi forgiarsi il punteggio mostrato come "valutazione di Claude" sulla propria proposta. La prompt injection via body dei contributi (iniettati dentro `<proposta>` in `evaluateWithClaude`) è una via strettamente più debole aperta allo stesso identico insieme di attori, già mitigata da system prompt anti-injection + structured output + clamp TS.

**Impact:** Low. Tool interno invite-only; l'allargamento della superficie è una scelta deliberata documentata negli header di 0013/0016 (l'alternativa scartata — allargare a qualsiasi commentatore — è stata correttamente evitata). Il danno possibile è solo l'integrità della prioritizzazione (score/rationale falsificati o fuori scala), nessuna escalation né disclosure; la rationale è resa JSX-escaped.

**Fix when touched:** Spostare il backstop a DB: in `apply_ai_evaluation` rifiutare (o clampare) fattori fuori da 1–10 e applicare `left(p_rationale, 2000)`, oppure aggiungere `CHECK` sulle colonne score. Stessa classe del gap già registrato per `rice_votes` in [`be-careful.md`](be-careful.md) (`2026-07-05-58f8`) — conviene sanare entrambi nello stesso intervento.

### SEC-4 — Vulnerable transitive `postcss` via `next` (LOW)

**Where:** `pnpm-lock.yaml` — dependency path `.>next>postcss` (`postcss < 8.5.10`).

**Issue:** GHSA-qx2v-qp2m-jg93 (moderate): PostCSS's CSS stringifier does not escape `</style>`, enabling XSS when untrusted CSS is stringified into HTML.

**Impact:** Low. In this app PostCSS runs only at build time on our own Tailwind CSS — no untrusted CSS ever reaches the stringifier. The residual cost is a permanently red `pnpm audit --prod`, which masks future real advisories.

**Fix when touched:** Bump `next` once it ships with `postcss >= 8.5.10`, or add a pnpm override (`"pnpm": { "overrides": { "postcss": ">=8.5.10" } }`) and verify the build.
