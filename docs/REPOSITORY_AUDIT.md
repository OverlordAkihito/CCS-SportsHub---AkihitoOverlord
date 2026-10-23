# Sportshub Repository Audit

**Audit/implementation date:** 2026-10-23
**Scope:** Greenfield implementation in the previously empty application workspace, following the Sportshub brief. This audit reflects current source and local checks only; it is not a deployment or security certification.

## Stack and entry points

- Node.js 24 ES modules with no external package dependencies (`package.json`). The server uses `node:http`, `node:crypto`, and built-in `node:sqlite`.
- `src/server.js` is the HTTP/API/static-file entry point. `public/index.html` is the UI shell; `public/app.js` handles browser interactions; `public/styles.css` is the responsive design system.
- `src/db.js` creates a local SQLite schema for users, sessions, events, bookings, notifications, and audit records. It enables WAL and foreign keys, and includes a small compatibility migration for event location state.
- `src/auth.js` provides scrypt password hashing, opaque database-backed sessions, CSRF checking, role/session lookup, and process-local attempt throttling.
- `src/bootstrap-admin.js` is a local terminal-only first-administrator setup command.
- `tests/app.test.js` runs API integration checks against a temporary SQLite database.
- `README.md`, `.env.example`, and `.gitignore` document local use and keep local database/config files out of Git.

## Current behavior and evidence

| Area | Status | Evidence and known gap |
|---|---|---|
| Public landing and truthful empty state | Partial | `public/index.html`, `public/app.js`; event previews come from `/api/events`, and an empty database renders an empty state. Category browsing is not data-driven. |
| Event discovery/search | Partial | `GET /api/events` supports keyword, sport, and event-type filters. Date and availability filters, URL-restored filters, and pagination are absent. |
| Event detail | Partial | `GET /api/events/:slug` returns published event details, capacity counts, requirements, and booking options. Images and full change history are absent. |
| Map | Partial | `public/app.js` embeds OpenStreetMap and only uses administrator-entered, range-validated coordinates. No location tracking is used. Map is unavailable without network; advanced filter synchronization is absent. |
| Authentication/session | Partial | Register/login/logout, salted scrypt, opaque HttpOnly/SameSite session cookie, session expiry, CSRF token and per-process throttling are implemented. Google OAuth/OIDC, email verification, password recovery and enrollment verification are absent. |
| Authorization | Partial | `src/server.js` checks student session ownership and admin roles for admin endpoints; new accounts are server-assigned `student`. First admin is provisioned by local CLI. No organization-backed admin eligibility is established. |
| Event management | Partial | Admin can create/edit/publish/cancel/archive events; API validates schedule/capacity/coordinates. UI confirms event cancellation. Delete, media uploads and richer administration/search are absent. |
| Bookings | Partial | Participant and spectator types have independent capacities, unique constraints, transactional writes, pending/confirmed policies, and cancellation. No waitlist or multi-seat booking. |
| Admin decisions and notices | Partial | Admin can confirm/reject pending requests; student notices are private and event/booking changes are recorded. No email/push or bulk decisions. |
| Dashboard/profile | Partial | Student sees own bookings, notices, display name and sports interests; protected email/role fields cannot be edited. No photo, advanced booking filters, or account deletion/recovery. |
| Metrics/audit | Partial | Admin counts derive from SQLite; event and booking actions are audited. No exports or historical analytics. |
| Responsive/accessibility | Partial | Semantic labeled forms, status feedback, reduced-motion styling, mobile breakpoints and keyboard-usable controls exist. No formal WCAG audit or broad assistive-technology/device test was performed. |
| Setup/release | Partial | Local run and first-admin setup are documented and tests exist. Production deployment, HTTPS proxy, database operations, backups, monitoring, and recovery are not configured or verified. |

## Data and trust boundaries

- Authoritative user roles, event states, booking status, ownership and capacity checks live server-side.
- SQLite constraints enforce valid roles/statuses, foreign keys, unique user/event/type bookings, and nonnegative capacity. Booking writes use `BEGIN IMMEDIATE` and count both pending and confirmed records toward capacity.
- Student booking/profile/notification queries are scoped to the current database session user. Admin APIs check the session's stored role. Browser roles/ownership are not accepted as authority.
- Passwords are not logged or returned in API responses. Sessions store only a hash of the random cookie token. The setup password is entered without terminal echo.
- Test data uses `.test` identities and a temporary database; no fixture is written into the app's local database.

## Ranked risks and limitations

| Rank | Finding |
|---|---|
| Critical | The requested Google OIDC sign-in and college enrollment verification are not implemented. Email/password registration alone does not establish a person's Gordon College enrollment. Do not use this as a student-verified production service. |
| High | Email verification and account recovery are absent; admin bootstrap assumes trusted local terminal access. Production administrator eligibility/provisioning remains unresolved. |
| High | Rate limiting is in-memory and per-process; it is not durable or shared across multiple instances. |
| High | SQLite is configured for local single-instance use. Backup, restore, retention, and production durability have not been designed or tested. |
| Medium | OSM map requires external network access. Its embed is attributed, but no availability/fallback or usage-scale review was conducted. |
| Medium | Date/availability filters, pagination, uploads, waitlist, richer account lifecycle, and broader accessibility verification remain incomplete. |

These are implementation gaps or assessment limits, not the result of a penetration test.

## Configuration and commands

Current environment names: `PORT`, `DATABASE_PATH`, `NODE_ENV`. `.env.example` contains safe defaults only. No OAuth secrets, API keys, payment credentials, or external backup variables are implemented.

Safe local commands (Node.js 24+; no package installation is required):

```powershell
npm start
npm run admin:bootstrap
npm run check
npm test
```

`npm run check` and `npm test` are the project checks; there is no bundler or separate compilation/build script. The test suite exercises a concurrent race for the last participant place and a later cancellation/retry in addition to auth, roles, admin decisions, notices, and CSRF. Observed results are recorded in `context/WORK_STATE.md`. Live Google sign-in, college verification, production database/deployment, external map availability, backups, and restore were not tested or configured.

## Next steps

1. Select and configure a maintained Google OIDC integration; decide a verifiable enrollment policy and secure admin provisioning.
2. Make an explicit production architecture decision for hosting, database/session storage, shared rate limiting, backup/recovery, HTTPS, and monitoring.
3. Expand functional coverage for date/availability filtering, event lifecycle edge cases, cancellation rules, duplicate/concurrent requests, and accessibility.
