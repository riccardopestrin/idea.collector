# Accessibility Findings → docs/roadmap/accessibility.md

Any accessibility-related finding raised by `Software Reviewer` or `Review Reviewer` MUST be recorded as a numbered entry in `docs/roadmap/accessibility.md` before the task is considered done. **Do NOT fix accessibility findings in the same session by default — they are deferred to a follow-up PR.**

`docs/roadmap/accessibility.md` is the single durable registry of known a11y issues for this codebase. Findings that live only in chat or PR comments disappear with the conversation.

## When this rule fires

After the `Review Reviewer` returns its filtered action list:

1. Identify every finding whose root cause is accessibility — keyboard navigation, focus management, ARIA roles/attributes, screen-reader semantics, color contrast, motion preferences, focus visibility, modal/dialog behavior, hit-target sizing, tab order, semantic HTML, alt-text, heading hierarchy.
2. **Default action: record each one in `docs/roadmap/accessibility.md` as a new `[A11Y-NN]` entry. Do NOT fix it in the current session.**
3. For every accessibility finding:
   - Open `docs/roadmap/accessibility.md`.
   - Add a new entry under "Issue aperti" using the next sequential `[A11Y-NN]` ID (never reuse retired IDs).
   - Update the `Last updated:` line at the top.
4. In the final summary, list the deferred a11y items on one line each (title + `[A11Y-NN]` id) so the user sees what was recorded. The user may then explicitly say "fix [A11Y-NN]" to reopen any of them — but the default is deferral.

## What counts as an "accessibility finding"

A finding belongs in this registry if it impacts:

- **Keyboard users** — element not focusable, no `Enter`/`Space` activation, no Esc-to-dismiss, missing `tabIndex`, broken tab order.
- **Screen-reader users** — missing or wrong `aria-*` attribute, missing label, mis-applied `role`, lost semantic element (e.g. heading turned into button).
- **Focus management** — no focus trap in modal, no focus restoration on close, no `:focus-visible` style.
- **Visibility / motion** — no respect for `prefers-reduced-motion`, color-contrast below WCAG AA, hit-target too small (<44 px on touch).
- **Modal/dialog primitives** — missing `aria-modal`, `aria-hidden`/`inert` on the rest of the page, scroll lock missing.
- **Forms** — input without associated label, error message not linked via `aria-describedby`, required field not announced.

If you're unsure whether a finding belongs here vs. `docs/security/be-careful.md`: a11y is for AT/keyboard/perception issues; be-careful is for behavioral/security/perf assumptions. They don't overlap.

## What to skip

- Accessibility findings that you actually fix in this session — no deferral needed; remove or never add the entry.
- Findings already captured under an existing `[A11Y-NN]` entry — extend that entry with a cross-reference line instead of duplicating.
- Pure styling preferences with no AT/keyboard impact (e.g. "this border-radius should be 8 not 6") — these are review noise, not a11y issues.

## Required entry structure

Follow the existing `docs/roadmap/accessibility.md` format:

```markdown
### [A11Y-NN] <short title>

**Status:** non fissato — flaggato il YYYY-MM-DD durante review della PR `<branch>`.

#### Dove
- `<file:line references>`

#### Cosa c'è di sbagliato
<concrete description of the a11y gap>

#### Impatto user-visible
<who is affected, with severity>

#### Fix raccomandato
<concrete steps; reference the canonical accessible pattern in this codebase if one exists (e.g. an existing keyboard-navigable / ARIA-labelled component)>

#### Cronologia
- YYYY-MM-DD — Flaggato durante <review/branch>.
```

Numbered `[A11Y-NN]` IDs are stable and never reused. When an issue is fixed, move the entry to "Issue risolti" with the resolution date — keep the same ID.

## Ordering in the task flow

This rule slots into the canonical sequence from `code-review.md`, alongside `nice-to-have-to-be-careful.md`:

1. Write / edit code.
2. Run tests (`run-tests-after-changes.md`).
3. Read `docs/security/be-careful.md` and flag overlaps.
4. `Software Reviewer` → `Review Reviewer` → fix BLOCKER/IMPORTANT findings → re-run tests.
5. **→ Auto-defer every accessibility finding by adding a `[A11Y-NN]` entry to `docs/roadmap/accessibility.md`. Never ask the user first.**
6. Auto-defer every NICE-TO-HAVE non-a11y finding to `docs/security/be-careful.md` per `nice-to-have-to-be-careful.md`.
7. Re-run tests.
8. `Security Expert` (`security-review.md`).
9. Final summary to the user — include the list of newly-recorded `[A11Y-NN]` entries.

## Severity does not matter for deferral

Even an a11y finding that the reviewer marks as BLOCKER goes into the registry by default — accessibility work is being scheduled separately as documented in `docs/roadmap/accessibility.md`. The user may explicitly elevate one (`fix [A11Y-NN]`) and you reopen it; otherwise it stays deferred.

## Do not skip

An a11y finding that is not in `docs/roadmap/accessibility.md` is invisible to the next reviewer — it will be re-flagged, re-deferred, and the knowledge about *why* it was deferred will be lost. Record it once, properly.
