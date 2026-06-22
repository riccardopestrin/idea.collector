# ADR — When to Write One

Any change that crosses an architectural boundary MUST be preceded by an ADR under `docs/architecture/adr/`.

## Triggers

Write an ADR before implementing, when the change is any of:

- A new third-party dependency with long-term lock-in (swapping Supabase for another BaaS/database, adding or changing the AI/LLM provider behind the RICE-scoring feature, an auth provider, a payment processor)
- A change to the auth model (Supabase magic-link vs password, session handling, role model on `profiles`)
- A change to the data model that breaks existing queries (renaming core entities, new tenant concept, RLS-policy shape changes)
- A deployment-model change (hosting platform, single app → split services)
- Any change that would make a future engineer ask "why did you pick X?"

## Authorship & approval — owner only

ADRs are **authored and accepted only by the owner (Riccardo).** An ADR records a *binding* decision; binding decisions belong to the owner.

- **If you are not the owner** and you believe an architectural decision is needed: do not open an ADR. Propose the decision to the owner — lay out the options and trade-offs — and let the owner record the accepted decision as an ADR.
- **Do not add or edit files under `docs/architecture/adr/` yourself** unless you are the owner. The folder is owner-only ([`change-control.md`](change-control.md)).

## How

ADRs are **hand-written, MADR-lite** Markdown files under `docs/architecture/adr/` — no scripts, no generated index.

1. Before writing code, create the ADR file by hand.
2. Fill in the lightweight template: Context / Decision / Consequences. One page max.
3. Commit the ADR in the same PR as the implementation.
4. If the decision is later replaced, write a new ADR and set `superseded_by: <new>` on the old one — never edit the accepted original.

## If it doesn't fit one page

The decision space is too big to settle solo — take it to the owner and discuss the options before recording a single binding ADR. Keep the ADR itself to one page; the deliberation happens before it is written.

## Agent obligations

- Claude Code agents must propose an ADR (to the owner) when the task crosses a trigger above, BEFORE writing implementation code.
- Security Expert / Software Reviewer agents flag missing ADRs for trigger-crossing changes as a review finding.
