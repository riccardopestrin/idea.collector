# Host Machine Safety

## Never modify anything outside the project directory

- Do NOT install software, change system config, run `brew install`, `pip install` globally, etc.
- Do NOT modify files outside `src/idea.collector/`
- Builds and tests run locally with `pnpm` (e.g. `pnpm test`, `pnpm exec eslint src/`)

## .env file rules

- **NEVER read `.env.local`** — it holds the real Supabase keys and other secrets
- **Allowed to read:** `.env.example` only
- If a feature requires a new env var and `.env.example` is missing the entry → **stop and report it**, do not guess or invent values
- When adding new env vars, add them to `.env.example` with placeholder values and document them there. The core vars this project needs are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
