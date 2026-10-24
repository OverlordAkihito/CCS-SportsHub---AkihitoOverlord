# Architecture Record

## Evidence status at bootstrap

The first-run inspection found only the context keeper and no app source. The current application architecture below was added during the Sportshub implementation session; see `docs/REPOSITORY_AUDIT.md` for the updated evidence.

## Current implementation

- **Runtime:** Node.js 24 ES modules; no third-party runtime dependencies (`package.json`). Uses `node:http`, `node:crypto`, and built-in `node:sqlite`.
- **HTTP/data boundary:** `src/server.js` serves static files from `public/` and handles JSON API routes. Browser values are untrusted; role, session identity, booking state, and capacity are checked on the server.
- **Persistence:** `src/db.js` initializes SQLite tables and indexes for users, sessions, events, bookings, notifications, and admin audit records. SQLite WAL and foreign keys are enabled. Booking mutations use `BEGIN IMMEDIATE`, status constraints, unique user/event/type bookings, and separate participant/spectator capacity counts.
- **Identity/session:** `src/auth.js` stores scrypt password hashes and opaque random session tokens as SHA-256 hashes, with HttpOnly/SameSite cookies, expiration, logout, CSRF checking, and process-local attempt throttling. Google OAuth/OIDC is not implemented; this is a material requirement gap.
- **Roles:** public self-registration creates `student`; `src/bootstrap-admin.js` creates the initial `admin` in a terminal. Admin APIs use server session role checks.
- **Local admin recovery:** `src/recover-admin.js` lists admin email addresses and interactively resets a selected account password. The reset revokes that account's sessions in a SQLite write transaction. It requires direct local operator access and uses the same `.env`/`DATABASE_PATH` configuration as the app.
- **UI:** `public/index.html`, `public/styles.css`, and `public/app.js` implement landing, discovery, event detail, map, student dashboard, profile, and admin workspace. OSM embed is external and requires network; only entered coordinates are mapped.
- **Configuration:** `PORT`, `DATABASE_PATH`, and `NODE_ENV` are read from the process environment/`.env`; secret values are not committed. No provider keys are configured.

## Important constraints and gaps

- No maintained OIDC library was available in the bundled modules and the package-registry query did not complete. Google login was not approximated with hand-written OAuth. Add a maintained OIDC integration when dependencies and owner OAuth configuration are available.
- This is a local, single-process development architecture. SQLite and process-local throttling are not a production multi-instance design. There is no backup/restore procedure or deployment configuration.
- The built-in Node SQLite API requires Node 24 as declared in `package.json`.
- Map tiles/frames are served by OpenStreetMap; attribution is included. No map provider key is required or stored.

## Open architecture decisions

- Production host, database/session service, backup and restore, monitoring and rate-limit store.
- Google OAuth client and callback configuration; enrollment-verification method; who can be an administrator and how additional admins are provisioned.
- Retention and account deletion/recovery behavior.

See `docs/REPOSITORY_AUDIT.md` for evidence, validation, and ranked risks.
