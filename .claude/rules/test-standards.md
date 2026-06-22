---
description: Minimum requirements for testing app logic and features.
---

# Testing Standards

Code stability is vital for the MVP launch. The test stack is **Vitest + React Testing Library** (unit/component). Playwright E2E is **deferred** — not yet configured — so do not write or mandate E2E specs.

1.  **Unit Tests**: Business logic, parsers, and scoring (e.g. RICE/ICE computation, proposal validation, data transforms) must have at least 80% line coverage. Test the real logic, not scaffolding.
2.  **Component / flow Tests**: Core flows must be covered with React Testing Library — assert on rendered text, roles, and interaction outcomes (see `test-audit.md` for what counts as a real assertion vs. a useless one).
