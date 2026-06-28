**Last updated:** 2026-06-28

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

### SEC-1 — User enumeration via verbatim OTP error (LOW)

**Where:** [`src/app/login/page.tsx`](../../src/app/login/page.tsx) — `sendCode()` shows `error.message` verbatim in the `role="alert"`.

**Issue:** With `shouldCreateUser: false`, Supabase returns a distinguishable error when the email is not a registered user. Rendering that message verbatim lets an unauthenticated visitor tell registered emails apart from unregistered ones (account enumeration).

**Impact:** Low. Access is invite-only and internal; enumeration only reveals which addresses are members, not credentials. No account takeover.

**Fix when touched:** Show a generic, non-distinguishing confirmation after `sendCode()` (e.g. "Se l'indirizzo è abilitato, riceverai un codice") regardless of the Supabase result, and only surface real errors for the verify step. Supabase's server-side rate limiting already throttles brute-force probing.
