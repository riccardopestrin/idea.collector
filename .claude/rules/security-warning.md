# Security Warning Rule

At the start of every conversation, silently check `docs/security/issues.md` for any open HIGH severity issues (lines under the `## 🔴 HIGH` section that are not marked ✅ resolved).

If HIGH issues exist, warn the user immediately with a message like:

> ⚠️ **Security:** `docs/security/issues.md` has open HIGH severity issues that must be resolved before production deployment. See `docs/security/README.md` for details.

Then list each HIGH issue by ID and title.

Do this check once per conversation, at the very start — not on every message.
