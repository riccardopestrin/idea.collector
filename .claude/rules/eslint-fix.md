# ESLint Fix Rule

After modifying or creating files under `src/`, you MUST run ESLint and fix all errors before considering the task done.

## Command

```bash
pnpm exec eslint src/ 2>&1
```

## Common errors and fixes

1. **`simple-import-sort/imports`** — Run `pnpm exec eslint --fix <file>` to auto-sort imports.
2. **`@typescript-eslint/no-floating-promises`** — Prefix fire-and-forget promises with `void` (e.g., `void router.push(...)`) or await them.
3. **`@typescript-eslint/no-unused-vars`** — Prefix unused destructured variables with `_` (e.g., `data: _data`). Remove truly unused imports/variables.
4. **`react-hooks/exhaustive-deps`** — Add missing dependencies or add an eslint-disable comment with a clear reason if intentional.

## Rules

- Fix all **errors**. Warnings in files you did not touch may be left alone.
- Never use `eslint-disable` to suppress errors unless there is a documented reason (e.g., intentional mount-only effect).
- If `--fix` can resolve the issue automatically, use it. Otherwise fix manually.
- Do NOT install new ESLint plugins or modify the ESLint config without explicit user approval.
