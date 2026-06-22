# Package Manager

**Always use `pnpm` instead of `npm`.**

## Commands
- Install deps: `pnpm install` (not `npm install`)
- Add a package: `pnpm add <pkg>` (not `npm install <pkg>`)
- Add a dev package: `pnpm add -D <pkg>`
- Run scripts: `pnpm run dev`, `pnpm test`, etc.
- Execute binaries: `pnpm exec vitest` or `pnpm vitest` (not `npx`)

All commands run at the repo root — there is no `web/` subdirectory.

## Why
- Faster installs, strict dependency resolution, disk-efficient via content-addressable store
- The project uses `pnpm-lock.yaml` as its lockfile — never generate or commit `package-lock.json`
