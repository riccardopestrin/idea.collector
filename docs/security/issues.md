**Last updated:** 2026-06-28

# Security Issues

Open-issues registry for the security review flow (`Software Reviewer` → `Review Reviewer` → `Security Expert`, see [`README.md`](README.md)). Each finding lives under its severity section with a stable ID; resolved entries are marked `✅ resolved (YYYY-MM-DD)` and may be deleted by hand once no longer useful. **Issue IDs are never renumbered or reused.**

## 🔴 HIGH

_Nessuna issue aperta._

## 🟠 MEDIUM

_Nessuna issue aperta._

## 🟡 LOW

- **SEC-1** — User enumeration via verbatim OTP error message on `/login`. `signInWithOtp({ shouldCreateUser: false })` returns a distinguishable error for unregistered emails, surfaced verbatim in the `role="alert"`. An unauthenticated visitor can probe which emails are registered. Low impact for an invite-only internal tool; details in [`README.md`](README.md#sec-1).
