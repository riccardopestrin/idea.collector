# Security Review Rule

After completing any coding task that modifies source files (under `src/` or `supabase/migrations/`), you MUST:

1. Spawn a `Security Expert` agent to review the changes made in the current session.
2. The agent must update `docs/security/README.md` and `docs/security/issues.md` if new issues are found or existing ones are resolved — following the single-line-header invariant below.
3. If the agent finds any HIGH severity issue, you must warn the user explicitly in the chat before ending your response.

## Trigger conditions
- Files modified under: `src/`, `supabase/migrations/`, `.env.example`
- This rule does NOT apply to: documentation-only changes, test-only changes that add no new logic, generated code.

## Agent instructions

Pass the list of modified files to the Security Expert agent and ask it to:

1. **Review** each changed file for the vulnerability classes in `docs/security/README.md`.
2. **Add new findings** to `docs/security/issues.md` under the appropriate severity section, and a matching detailed block to `docs/security/README.md` under `## Findings`.
3. **Mark resolved issues** as `✅ resolved (YYYY-MM-DD)` in `docs/security/issues.md`. Leave the resolved entry in place; it may be deleted by hand once it is no longer useful — there is no archive rotation.
4. **Keep the `**Last updated:**` header a single line** on both files:
   ```
   **Last updated:** YYYY-MM-DD
   ```
   **Never concatenate a "Prior note:" narrative onto the header.** The header is a single date — nothing more.
5. **Never renumber issue IDs.** Resolved IDs are retired and never reused, so cross-file references stay valid.
6. **`docs/security/README.md` must stay actionable-only** — vulnerability-class guidelines + open findings. Per-session narrative does not belong in the live files.
