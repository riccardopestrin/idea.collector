# DRY — Reuse Beyond Styling

This rule covers all forms of repetition in `src/` — duplicated JSX, logic, prop shapes, class strings, and magic numbers.

## When writing or modifying files under src/

### Repeated JSX structures

If you are about to write a JSX tree that already exists in another component (same elements + same prop shape + same children structure), stop. Search `src/components/` for an existing match first. If one exists, use it. If not, extract a shared component.

### Repeated Tailwind class strings

If the same non-trivial `className` string (or the same long combination of utilities) appears in 2+ places, extract it — into a shared component that owns the markup, or a named constant/helper in `src/lib/utils/`. Do not copy-paste a class string across files.

### Repeated logic

If a `useState` + `useEffect` pair, event handler pattern, or data-transform function appears in 2+ components, extract it into:
- A custom hook at `src/lib/hooks/use<Name>.ts` (for stateful logic)
- A utility at `src/lib/utils/<name>.ts` (for pure functions)

### Repeated prop shapes

If 3+ props are always passed together across components (e.g., `label`, `score`, `variant` always travel as a group), consider whether they should be a single object prop or a dedicated component.

### Magic numbers

Never hardcode layout dimensions, breakpoints, or tuning constants inline. Use tokens from a shared module under `src/lib` (e.g. `src/lib/tokens.ts`). If a token does not exist yet, add it there rather than inlining the value.

### Before creating a new shared abstraction

1. Search `src/components/`, `src/lib/hooks/`, and `src/lib/utils/` for an existing match
2. If one exists, use it — do not create a near-duplicate
3. If creating new: follow the surrounding conventions and add tests for shared components
