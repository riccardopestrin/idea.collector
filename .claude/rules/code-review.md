## Code Review Rule

After completing any coding task that modifies source files (under `src/` or `supabase/migrations/`), and **before** running the `Security Expert` per `security-review.md`, you MUST run a two-stage code review.

### Pre-requisite: read `docs/security/be-careful.md`

Before starting Stage 1, you MUST read `docs/security/be-careful.md`. It lists issues known and consciously deferred — problems that don't trigger in the current use case but can wake up if an assumption changes. If the files you modified overlap with any entry in `docs/security/be-careful.md`:
- Check whether your change invalidates the "why it isn't a problem today" condition.
- If yes, stop and surface the conflict to the user before proceeding — the deferred issue must be re-evaluated.
- Mention in the hand-off to the `Software Reviewer` which `docs/security/be-careful.md` entries are in scope for this change.

### Review stages

1. **Stage 1 — Software Reviewer**
   - Spawn the `Software Reviewer` agent.
   - Pass it the list of files modified in this session and a short summary of what was done.
   - It must follow its own prompt strictly and return a structured findings report with a verdict.

2. **Stage 2 — Review Reviewer**
   - Spawn the `Review Reviewer` agent.
   - Pass it the **full, verbatim** report from the `Software Reviewer` plus the same list of modified files.
   - It must investigate each finding, filter false positives, justify each verdict, and return a filtered action list with an overall verdict.

3. **Fix phase**
   - If `Review Reviewer` returns `APPROVED TO PROCEED`, fix every BLOCKER and IMPORTANT item in the filtered action list in priority order.
   - If `Review Reviewer` returns `BLOCKED`, stop and surface the blocker to the user before touching the code.
   - After fixing, re-run the applicable test suites per `run-tests-after-changes.md`.

4. **NICE-TO-HAVE deferral (automatic, no question)**
   - After BLOCKER/IMPORTANT fixes land, any NICE-TO-HAVE items in the `Review Reviewer`'s filtered action list are deferred to `docs/security/be-careful.md` by default per `nice-to-have-to-be-careful.md`.
   - Do NOT ask the user whether to fix them in-session. Record each one as a new entry (or extend an existing one) and mention the deferred items in the final summary so the user can explicitly ask to reopen any.

5. **Then, and only then**, proceed with the `Security Expert` per `security-review.md`.

## Ordering

The canonical end-of-task sequence is:
1. Write / edit code.
2. Run tests (`run-tests-after-changes.md`).
3. Read `docs/security/be-careful.md` and flag any overlap with the modified files.
4. `Software Reviewer` → `Review Reviewer` → fix BLOCKER/IMPORTANT findings → re-run tests.
5. Auto-defer every surviving NICE-TO-HAVE to `docs/security/be-careful.md` per `nice-to-have-to-be-careful.md` — never ask the user first.
6. `Security Expert` (`security-review.md`).
7. Final summary to the user.

## Hand-off format

When calling `Review Reviewer`, include in the prompt:
- A bullet list of the files changed.
- The `Software Reviewer`'s full report, unedited, wrapped in a clear delimiter.
- A reminder to hunt false positives, propose concrete fixes, and return a filtered action list.

## Do not skip
Neither agent may be skipped. A review that was not passed through `Review Reviewer` is not a completed review. An undocumented or un-reviewed change is a regression risk.
