# No Skipping Tests

Green CI means the tests actually ran and passed. This rule keeps "green" honest by separating the three different things people mean by "skip" — only one of them is ever acceptable, and even that one leaves a paper trail.

## 1. Skipping tests in code — never

Do **not** disable a test to get a green build: no `it.skip` / `xit` / `describe.skip` (Vitest), no commenting-out, no `return` at the top of a test body, no deleting a failing assertion.

This is the dangerous skip: it keeps the check green while coverage silently drops, so the next regression in that area ships unnoticed. It compounds `run-tests-after-changes.md` ("never skip or comment out tests") and `test-audit.md`.

- **Flaky test?** Re-run it in isolation to separate a real regression from a parallel-run flake (`pnpm test <file>`). If it's genuinely flaky, fix the flake or quarantine it with a tracking entry (a `docs/security/be-careful.md` item or a roadmap line) — never a bare `.skip` with no paper trail.
- **Test is wrong for a deliberate behavior change?** Update the assertion to the new expected behavior. That's editing a test, not skipping it.

## 2. Skipping the CI run — not on PRs to `main`

- No `[skip ci]` / `[ci skip]` on the commits of a PR that targets `main`. (Fine on a throwaway WIP branch that won't merge.)
- Do **not** "fix" a stuck required check by un-requiring it. Restore the check; don't remove coverage.

## 3. Bypassing the gate at merge — emergencies only, and it costs an incident note

Routine work never bypasses a red or pending CI gate. Tests must be green for everyone, including the owner. A red `main` is itself an incident.

- **Routine work: never bypass.**
- **Bypass only for a declared production-down emergency** where waiting for CI would extend a live outage.
- **Every bypassed merge requires a written incident note** (what was bypassed, why, and the follow-up that restores green). A bypass with no incident note is a process violation.

## Agent obligations

When working in this repo, Claude and its agents must:

- Never introduce a skipped/ignored/commented-out test to make a suite pass. If a test legitimately must change, change the assertion to the correct new expectation and say so in the summary.
- Never add `[skip ci]` to a PR-bound commit, and never propose un-requiring a check to get around a stalled gate.
- If asked to bypass CI, confirm it's a declared emergency and remind the user that a written incident note is required; do not perform the bypass yourself (only the owner, Riccardo, can).

## Why this exists

The whole point of the CI gate is defeated the moment "green" stops meaning "the tests ran and passed." Skipping a test to go green manufactures a coverage gap on purpose — the next regression in that area then ships unnoticed.
