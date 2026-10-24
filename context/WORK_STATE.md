# Work State

**Current milestone:** Sportshub local implementation with core event/booking flows and local operator-assisted admin credential recovery; provider and production decisions remain open.

## Active work

- [x] Inspect the keeper-only workspace and attached Sportshub requirements.
- [x] Build persisted SQLite server routes, role checks, auth sessions, event management, booking capacity rules, notifications, and responsive UI.
- [x] Add isolated API integration tests and local setup documentation.
- [x] Add interactive local admin recovery command to list admin email addresses and reset a selected password while revoking active sessions.
- [ ] Add maintained Google OIDC and owner-configured OAuth, then decide enrollment verification.
- [ ] Select production hosting, durable database/session/rate-limit architecture, backups, and monitoring.

## Checks actually run

- `npm run check` — PASS: all server, client, bootstrap and test JavaScript syntax checks completed.
- `npm test` — PASS: 2 integration tests passed (registration/auth, role denial, event/booking persistence, concurrent last-place capacity, separate capacities, booking decision, capacity release on cancellation, event cancellation notice, and CSRF failures).
- Browser preview at `http://localhost:3000` — PASS: landing, event discovery empty state, and sign-in dialog rendered; no live event data exists.
- `python scripts/context_sync.py` with bundled workspace Python — PASS: generated `context/AUTO_STATE.md`.
- `python scripts/context_validate.py` with bundled workspace Python — PASS: all 18 required keeper files/sections found.
- `npm run` — PASS: confirmed available `start`, `dev`, `admin:bootstrap`, `check`, and `test` scripts; no build/bundle script exists.
- `git diff --check` — PASS: no whitespace errors. Git displayed only line-ending normalization warnings for Markdown/Python files.
- No separate build command exists; this implementation has no compilation/bundling step.
- `npm run check` includes syntax validation of `src/recover-admin.js`.
- `npm run admin:recover` was not run against the user's live database; recovery remains a user-operated local command.
- No deployment, live OAuth, enrollment verification, map-provider availability, production hardening, or backup/restore test was run.

## Blockers / unknowns

- Google OAuth/OIDC library and owner client/callback configuration are not available; no custom OAuth flow was written.
- No enrollment verification policy or trusted organizational admin provisioning decision exists.
- This remains single-process SQLite local development; production host, data durability, backups, and shared rate limiting are undecided.

## Next action

Run `npm run admin:recover` from the project root in an interactive terminal to identify the forgotten admin email and set a new password; then sign in at `http://localhost:3000`. After access is restored, select a maintained OIDC library and account/enrollment policy.
