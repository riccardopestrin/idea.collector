# Naming Consistency — Match the Neighbours Before You Name

Names and descriptions must be consistent with the artifacts around them. A name is
read far more often than it is written, and the reader's expectation is set by every
sibling they have already seen. So before introducing **any** name — a filename, a class,
a function, a component, a variable, or a test description — look at how
the artifacts of the same kind in the same place are already named, and conform. Consistency
beats individual cleverness. An "improved" naming scheme that only one file follows is worse
than a mediocre scheme that every file follows.

This rule exists because an agent-written Vitest leaf shipped a run-on camelCase
description, `it("contributorQueriesDoNotLeakDraftRejectedProposals")`, into a suite
where the surrounding assertions are plain readable sentences. The name was not *wrong* in
isolation — it was wrong *for its neighbours*. That is the failure this rule prevents.

## The obligation — survey siblings, then name

Before creating a named artifact, survey the existing siblings of the same kind and match the
prevailing pattern. This is a hard obligation for **every code-generating agent**, in every
session, regardless of how the request is phrased. Where to look, by artifact:

- **A new file** — list the directory it lands in and match the casing/suffix the siblings use
  (e.g. components in `PascalCase.tsx`, hooks as `use<Name>.ts`, utils in `kebab-case.ts` or
  `camelCase.ts` — follow whatever the folder already does).
- **A React component / function / variable** — match the naming shape of the symbols already
  declared in the same module and its siblings.
- **A Vitest `describe` block** — name it after the real symbol or unit under test
  (`describe("computeRiceScore")`).
- **A Vitest leaf (`it` / `test`)** — write a readable phrase that completes "it …"
  (`it("returns 0 when reach is zero")`), not a whitespace-free camelCase identifier.


## What this rule blocks

`Software Reviewer` MUST flag each of these as an **IMPORTANT** finding, with a concrete
rename proposed:

- A new name that **diverges from the established sibling convention** of its directory/spec/
  module (the surrounding files use one shape, the new one invents another).
- Specifically: a **leaf** test description (`it`/`test`/`should`/`xit`/`xtest`) written as a
  whitespace-free camelCase identifier instead of a readable phrase.
- A file/component/symbol whose casing or suffix breaks the pattern every neighbour follows.

## What this rule does NOT block

- `describe()` naming a **real code symbol** in camelCase
  (`describe("computeRiceScore")`, `describe("getOrCreateProfile")`) — that is the subject under
  test, and it is correct.
- Single-word leaf labels (`test("smoke")`).
- A genuinely **new area with no siblings** — there is nothing to match yet. Establish one
  clear convention and follow it consistently thereafter.


## Trigger conditions

Fires whenever a source or test file is created or modified under `src/`,
and on the introduction of any new named artifact. Does NOT apply to generated code.



