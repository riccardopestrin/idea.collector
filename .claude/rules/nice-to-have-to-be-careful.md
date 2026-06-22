# NICE-TO-HAVE Findings → docs/security/be-careful.md

Any NICE-TO-HAVE finding that survives the code-review chain (`Software Reviewer` → `Review Reviewer`) and is **not fixed in the same PR** MUST be recorded in `docs/security/be-careful.md` before the task is considered done.

A NICE-TO-HAVE that is only mentioned in chat disappears with the conversation. `docs/security/be-careful.md` is the single durable registry of known-but-deferred issues — if a finding is worth deferring, it is worth documenting there.

## When this rule fires

After the `Review Reviewer` returns its filtered action list and BLOCKER/IMPORTANT items are fixed:

1. **Default action: defer every surviving NICE-TO-HAVE to `docs/security/be-careful.md`. Do NOT ask the user.**
2. For every NICE-TO-HAVE:
   - Open `docs/security/be-careful.md`.
   - Add a new entry with a unique ID in the format `YYYY-MM-DD-XXXX` (today's date + a 4-char hash). See "ID format" below.
   - Update the `Last updated:` line at the top.
3. In the final summary, list the deferred items on one line each (title + the new ID in backticks) so the user sees what was recorded. The user may then explicitly say "fix `<id>`" to reopen any of them — but the default is deferral, not a question.

## ID format — `YYYY-MM-DD-XXXX`

Each entry has a stable ID combining the date the finding was flagged with a 4-char hash. **Never reuse, renumber, or rewrite an ID once assigned**, even after the entry is resolved and archived. Cross-references between entries use the ID in backticks (`` `2026-05-09-a3f2` ``).

### Why this format

The legacy integer ID format (`[N]`) caused merge conflicts every time two PRs added new entries in parallel — both branches grabbed the next free integer, and resolving the conflict required manual renumbering plus updating cross-references. With date+hash IDs, two reviewers in different branches generate non-colliding IDs by construction; merging is a clean append.

### How to generate an ID

The hash component should be unique within the document. Any of the following is acceptable:

- 4 hex chars from a SHA1/MD5 of the entry title (deterministic; preferred when scripting)
- 4 random base16/base36 chars (`openssl rand -hex 2`, or any short random)
- A short slug derived from the title (`2026-05-09-flytotarget` is fine if shorter than 16 chars)

Verify uniqueness with `grep -c "<id>" docs/security/be-careful.md` before committing — if the count is non-zero, regenerate.

## What to skip

- NICE-TO-HAVE findings that you actually fix in this session — no deferral needed.
- Findings already captured under an existing entry — extend that entry with a cross-reference line instead of duplicating.
- Purely stylistic nits that carry no behavioural risk (formatting, naming preferences with no downstream effect) — these are review noise, not deferred issues.

## Required entry structure

Follow the existing `docs/security/be-careful.md` format:

```markdown
## `YYYY-MM-DD-XXXX` <short title>

**Status:** non fissato — non si verifica nell'attuale use case.

### Dove
- <file:line references>

### Il problema potenziale
<what breaks if the assumption changes>

### Perché oggi non è un problema
<the current invariant that keeps this dormant>

### Quando diventa un problema
<numbered list of triggers>

### Cosa fare se devi toccare quest'area
<concrete steps or code pointers>

### Cronologia
- YYYY-MM-DD — Flaggato durante <review/branch>. Downgrade a NICE-TO-HAVE perché <reason>.
```

## Resolving entries

When a deferred issue is fixed in a later PR:

1. Mark the entry's `**Status:**` line as `✅ risolto YYYY-MM-DD — <one-line explanation>`. Do NOT change the ID.
2. A resolved entry may be moved to the `## Risolti recenti` section (or deleted by hand) once it is no longer useful — there is no archive rotation and no `docs/history/` to maintain.
3. The ID stays valid forever — cross-references in older PRs and this file remain resolvable, even after the entry is deleted.

## Ordering in the task flow

This rule slots into the canonical sequence from `code-review.md`:

1. Write / edit code.
2. Run tests (`run-tests-after-changes.md`).
3. Read `docs/security/be-careful.md` and flag overlaps.
4. `Software Reviewer` → `Review Reviewer` → fix confirmed findings.
5. **→ Auto-defer every surviving NICE-TO-HAVE by adding/extending a `docs/security/be-careful.md` entry with a fresh `YYYY-MM-DD-XXXX` ID. Never ask the user first.**
6. Re-run tests.
7. `Security Expert` (`security-review.md`).
8. Final summary to the user.

## Do not skip

An unfixed NICE-TO-HAVE that is not in `docs/security/be-careful.md` is invisible to the next reviewer — it will be re-flagged, re-deferred, and the knowledge about *why* it was deferred will be lost. Record it once, properly.
