# Simplicity — No Overengineering

The default failure mode of an AI coding agent is *overengineering*: adding abstraction, indirection, configuration, defensive branches, and prose for cases that don't exist yet. This rule exists to counteract that. **Write the simplest code that fully satisfies the actual requirement — and invest the extra design effort needed to find that simple solution.** Simple is not the same as quick or lazy; the simple solution is usually the one that took the most thought to arrive at.

This is the final application's structure, not an MVP. Clean, simple, idiomatic code compounds; cleverness and speculative machinery rot.

## The one test before adding anything

Before adding an abstraction, parameter, generic, wrapper, branch, config flag, or "for later" hook, ask:

> **Is there a real, present caller / case in this codebase that needs it right now?**

If the answer is "not yet / it might / to be safe / for the future" → **do not add it** (YAGNI). Add it the day a real caller appears. A parameter with one call site is not configurable — it's noise.

## What overengineering looks like here (flag and remove)

- **Speculative generality** — parameters, type params, or options with a single (or zero) real call site; "extension points" no one extends.
- **Needless indirection** — wrapper functions/classes/hooks that only forward to one other thing; a layer that adds a name but no behavior.
- **Defensive code for impossible states** — `try`/guards/`NonCancellable`/null-checks for conditions that cannot occur given the actual callers. Handle the cases that happen; don't gold-plate the ones that can't.
- **Parallel constructs instead of one** — two near-identical result/error/DTO types, two copies of the same Supabase fetch/response-handling block, two components that differ by a prop. Collapse to one (generic, type alias, shared helper, prop).
- **Scaffolding that exists only to prop up a test** — stateful mocks, fixtures, or harness machinery added solely to make one brittle test runnable. If a test needs that much scaffolding, the test is wrong (prefer a deterministic unit test of the real logic).
- **Premature optimization / patterns for their own sake** — a Strategy/Factory/Observer where a function or a `switch` would do. Patterns serve readability and reuse; don't summon them to look sophisticated.
- **Comment essays** — multi-paragraph JSDoc that narrates history, lists every consideration, or re-explains the obvious.

## What we DO want (the bar to clear)

- **Reuse first, zero duplication.** Search `src/components/`, `src/lib/`, and existing hooks/utilities before writing anything. If the same shape appears twice, extract it *once*. This rule is the spirit behind `dry-beyond-sx.md` and `dead-code-check.md` — generalized to all code.
- **Lean on the language and stdlib.** TS: discriminated unions, narrowing, `satisfies`, `Map`/`Set`, optional chaining, small pure functions, immutable updates. React/Next: Server Components for data fetching, Server Actions for mutations, composition over wrapper hierarchies. Prefer a built-in to a hand-rolled equivalent.
- **Established design patterns where they genuinely simplify** — a single source of truth, dependency injection over globals, pure functions over stateful tangles, one result monad over per-domain copies. Use the pattern that *removes* code, not the one that adds ceremony.
- **The smallest correct surface.** Fewer public members, fewer params, fewer branches. A function should do one thing; a module should have one reason to change.
- **2026 best practices** — modern idioms of each stack, immutability by default, typed errors over throwing-and-hoping, no dead code.

## Comments

Comments explain **why** (the non-obvious decision, the invariant, the gotcha) in **one or two lines** — not **what** the code already says. If the code needs a paragraph to be understood, simplify the code instead of writing the paragraph. Delete narration, changelogs-in-comments, and restatements. A short pointer to a ticket/ADR (`// see MEDIUM-17`, `// ADR-0012`) is fine.

## "A little more effort" is the point

Choosing the simple design is allowed — and expected — to cost more thinking, more searching for the existing utility, more refactoring of the surrounding code so the new piece fits cleanly. What is **not** acceptable is shipping extra abstraction/indirection because it was faster than finding the clean fit. More code is not more progress.

## Trigger & enforcement

- Fires on any change under `src/`,flags overengineering / duplication / comment-verbosity as findings (Category: `Overengineering`); `Review Reviewer` keeps them unless genuinely false. Prefer cutting code over adding it when resolving such a finding.
- When in doubt between two correct solutions, ship the one with **less** code, **fewer** concepts, and **no** new abstraction — unless a present requirement demands otherwise.
