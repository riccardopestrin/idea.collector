# Run Tests After Changes

After completing any code change under `src/` or `supabase/migrations/`, you MUST run the test suite and the linter before presenting the final summary. No exceptions.

## What to run

From the repo root (commands run at the root — there is no `web/` subfolder):

```bash
pnpm test                 # Vitest unit/component tests
pnpm exec eslint src/     # lint
```

- Unit/component tests must be **100% green**.
- ESLint must report no errors in files you touched (see `eslint-fix.md`).

Playwright **E2E is deferred** — it is not yet configured in this project. Do not attempt to run, or claim to have run, E2E specs. When E2E is later added, this rule will be updated.

## When to skip

Skip ONLY for:
- Documentation-only changes (`docs/`, `*.md`)
- Changes confined to `.claude/rules/`, `.claude/settings*.json`
- Changes to test files themselves that don't affect production code

If in doubt, run the tests.

## Reporting

Report results in the final summary with exact pass/fail counts, e.g.:

> Unit: 142/142 ✅ · ESLint: clean

Never claim a task is done without having run `pnpm test` and `pnpm exec eslint src/` in the same session.
