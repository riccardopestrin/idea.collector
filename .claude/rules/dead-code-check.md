# Dead Code Check Rule

## Before starting a feature

When the user asks you to implement a feature that will modify files under `src/`, **before writing any code**:

1. Identify which files/components you plan to modify
2. Spawn the `Dead Code Detector` agent in `pre` mode on those files
3. If HIGH dead code is found, warn the user:
   > **Dead code detected** in files you're about to modify. Clean up recommended before starting.
4. List the findings briefly and ask whether to clean up now or proceed

## After completing a feature

After you finish implementing a feature (all code written, ESLint clean, tests passing), **before presenting the final summary**:

1. Gather the list of all files you modified in this session
2. Spawn the `Dead Code Detector` agent in `post` mode on those files
3. If any dead code is found:
   - **HIGH**: Fix immediately (remove unused exports, dead props, orphaned files)
   - **MEDIUM**: Flag to the user with a recommendation
   - **LOW**: Note in summary (usually ESLint catches these)
4. Re-run ESLint and tests after any removals

## Trigger conditions

- Files modified under: `src/`
- This rule does NOT apply to: documentation-only changes, test-only changes, config file changes

## What to check

- Unused component props (declared in interface but never passed by any caller)
- Unused named exports (exported but never imported elsewhere)
- Orphaned shared components (under `src/` with zero consumers)
- Stale imports (imported but never referenced in the file — ESLint usually catches this)
- Unreachable conditional branches (prop always has same value at every call site)
