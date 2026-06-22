---
name: review-chain
description: Run the end-of-task review chain for idea.collector — Software Reviewer → Review Reviewer → fix BLOCKER/IMPORTANT → auto-defer NICE-TO-HAVE → Security Expert. Use after completing any coding task that modifies files under src/ or supabase/migrations/, before presenting the final summary. Trigger when the user says "review chain", "run the review", "review my changes", or "/review-chain".
---

# Review Chain

Operationalizes [`code-review.md`](../../rules/code-review.md) + [`security-review.md`](../../rules/security-review.md) + [`nice-to-have-to-be-careful.md`](../../rules/nice-to-have-to-be-careful.md) + [`accessibility-findings-to-roadmap.md`](../../rules/accessibility-findings-to-roadmap.md). Do the steps in order; do not skip a stage.

## Steps

1. **Scope.** Determine the files changed this session under `src/` or `supabase/migrations/`. Skip the whole chain only for docs-only, `.claude/`-only, or test-only changes (per `run-tests-after-changes.md`).

2. **Tests first.** Run `pnpm test` and `pnpm exec eslint src/`. Both must be green before review. Fix failures before continuing.

3. **Read deferred-issues registry.** Read [`docs/security/be-careful.md`](../../../docs/security/be-careful.md). If a changed file overlaps an entry, check whether the change invalidates the "why it isn't a problem today" condition; if so, surface it to the user before proceeding.

4. **Stage 1 — Software Reviewer.** Spawn the `Software Reviewer` agent with the list of changed files + a short summary. Capture its full report verbatim.

5. **Stage 2 — Review Reviewer.** Spawn the `Review Reviewer` agent with the Software Reviewer's full report (verbatim, delimited) + the same file list. It filters false positives and returns a filtered action list + verdict.

6. **Fix phase.**
   - `APPROVED TO PROCEED` → fix every BLOCKER and IMPORTANT in priority order.
   - `BLOCKED` → stop, surface the blocker to the user.
   - Re-run `pnpm test` + eslint after fixes.

7. **Auto-defer (no question).**
   - Accessibility findings → new `[A11Y-NN]` entry in [`docs/roadmap/accessibility.md`](../../../docs/roadmap/accessibility.md). Deferred by default, even BLOCKER severity.
   - Other surviving NICE-TO-HAVE → new `YYYY-MM-DD-XXXX` entry in [`docs/security/be-careful.md`](../../../docs/security/be-careful.md).

8. **Security Expert.** Spawn the `Security Expert` agent on the changed files. It updates `docs/security/README.md` + `docs/security/issues.md` (single-line `**Last updated:**` header, never renumber IDs, no prune script / no archives — lightweight). If it finds any HIGH, warn the user explicitly in chat.

9. **Final summary.** Report: tests (pass counts), review verdict, BLOCKER/IMPORTANT fixed, deferred items (one line each with their IDs), any HIGH security warning.
