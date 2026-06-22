# Change-Control Rule — who can change what

This is the ownership matrix for the repo. Read it first. It tells you which paths and actions are **owner-only** — owners: Riccardo

**Owners:** Riccardo = `@riccardopestrin99`

## Branch & history integrity (`.git`)

`main` is protected. Nobody — including owners in routine work — rewrites or force-pushes it.

- **No direct push to `main`.** Every change lands via a pull request.
- **No force-push, no branch deletion** on `main`.
- **Merge requires an owner's review** and a green CI run.

## Owner-only paths (changes need an owner's review to merge)

| Path | Why |
|---|---|
| `/.claude/` (whole folder) | Agent rules, settings, hooks, skills — the automation's behaviour. |
| `/docs/architecture/adr/` | ADRs are authored & accepted only by the owner ([`adr-when-to-write.md`](adr-when-to-write.md)). |
| `/supabase/migrations/` | Database schema migrations. |

Non-owners may *open a PR* against these paths — they just can't *merge* without an owner's review. For ADRs specifically, don't open one at all; propose the decision to the owner instead.

## Open to everyone

- **Declare / file incidents** — anyone may write up an incident without asking permission. Investigating, reproducing, root-causing, and drafting the note are open to all. (Applying the hotfix/deploy is owner-only — see below.)
- **Open PRs and branches**, write code and tests, propose changes anywhere.

## Deploys — owner-only

Only Riccardo deploys, to any environment. Everyone else prepares and hands off.

## For agents

Claude and its agents follow this matrix: never deploy, never author/accept an ADR, never merge to `main`, and surface (don't silently make) any change to an owner-only path.
