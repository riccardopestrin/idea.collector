# Layered Architecture & Cross-Cutting Concerns

This Next.js + Supabase app is a layered system in which each layer has exactly one job and dependencies point inward. This rule records where code belongs, so that a contributor — human or AI — never places a concern in the wrong layer.

## The three layers

| Layer | Its one job |
|---|---|
| **Transport** — a Route Handler (`src/app/**/route.ts`), a page/Server Component entry, or a form/Server-Action boundary | Authenticate only. It resolves the Supabase session into the current user, calls the application service, and maps errors to a response (HTTP status, redirect, or form error state). It holds no business rules. |
| **Application service / use-case** — a Server Action (`'use server'`) or a service function in `src/lib` | Authorize, and enforce business rules. It checks the role (`'admin' \| 'contributor'`) and any ownership or relationship rule, enforces business preconditions, and orchestrates the data layer. |
| **Data** — Supabase queries via `src/lib/supabase/{server,client}.ts`, plus the **RLS policies** in `supabase/migrations/` | Stay dumb. It reads and writes the database and does nothing else. **RLS policies are the enforced safety net** — the last line that holds even if a guard above is forgotten. |

Authentication is not authorization. Authentication resolves a request's identity into the current user and is a transport concern; authorization decides whether that user may perform an operation and lives in the service **and** in RLS. Conflating the two — most often by burying a permission check inside a React component or relying on UI to hide an action — is the single most common mistake this rule prevents.

## Placing a cross-cutting concern

Decide a concern's home by the scope at which it is decided.

1. **Once per request, regardless of operation, tied to the protocol or identity** — it belongs at the transport edge: in `proxy.ts` (the Next 16 middleware) or at the top of the Route Handler / page. This covers authentication (refreshing the Supabase session, redirecting unauthenticated users), request logging, and mapping an error to a status or redirect.
2. **Per operation, as a business rule that must be testable** — it belongs in the Server Action / service function. This covers authorization (role + ownership), business preconditions, and orchestration of multiple Supabase calls.
3. **Purely reading or writing data** — it belongs in the Supabase query layer, with RLS as the enforced backstop. This covers query shaping and the row-level policies themselves.
4. **Known at startup** — it belongs in environment configuration and is read through the Supabase client wrappers. `process.env` secrets never get read ad hoc inside a component.

Tie-breaker: if a concern would otherwise be copy-pasted at every call site, give it one explicit seam — a function in `src/lib` that every caller invokes. Always prefer an explicit call to a clever wrapper or decorator.

The concerns place as follows: authentication at the transport edge (`proxy.ts` / page entry resolves the session); authorization in the Server Action as a plain guard, e.g. `if (profile.role !== 'admin') throw new Error('forbidden')`, **backed by an RLS policy** so the database refuses the write regardless; business logic in the service; query shaping in the data layer; secrets read only through the Supabase client wrappers.

## What this rule blocks

The Software Reviewer flags each of the following as an IMPORTANT finding, because each tangles a concern into the wrong layer or relies on the wrong layer for safety:

- A role or authorization check buried only in a React component (e.g. hiding a button) with no matching Server-Action guard and no RLS policy. UI hiding is not authorization; the decision belongs in the service and the database must enforce it.
- Business logic or orchestration inside a Route Handler or `proxy.ts`. The edge authenticates and maps errors; the decision and orchestration belong to the Server Action / service.
- Calling Supabase directly from a Server Component to perform a mutation that needs authorization — mutations go through a Server Action that authorizes first; Server Components fetch read data.
- A privileged write that depends solely on a TypeScript guard with no RLS policy behind it. The guard can be bypassed (a forgotten call site, a direct query); RLS is the safety net that must always be present.
- A new abstraction — a permissions engine, an ACL table, a DI container, a role-hierarchy framework — introduced to enforce authorization. A plain guard plus an RLS policy is the whole mechanism; the rest is machinery.
- A read of a secret from `process.env` below the transport/config layer.
- A Server Action that only forwards to a single Supabase call, with no authorization and no orchestration. That is an anemic pass-through; let the Server Component read directly instead.

## Agent obligations

Place new code according to the layers above. When a request would put a concern in the wrong layer, do not comply silently — follow [`defend-separation-of-concerns.md`](defend-separation-of-concerns.md), push back, and propose the correct-layer alternative. RLS policies and SQL migrations (`supabase/migrations/`) and the auth surface are owner-locked under [`change-control.md`](change-control.md); surface changes there for an owner rather than landing them yourself. If a change crosses an architectural boundary, an ADR under `docs/architecture/adr/` may be required.

## Reference

- [`defend-separation-of-concerns.md`](defend-separation-of-concerns.md) — how to respond when a request would break this layering.
- [`simplicity-no-overengineering.md`](simplicity-no-overengineering.md) — the simplicity discipline this rule depends on.
