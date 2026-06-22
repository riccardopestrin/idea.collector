**Last updated:** 2026-06-22

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

_Nessun finding aperto._
