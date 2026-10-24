# Sportshub

Sportshub is a local-first sports event discovery and booking application for the Gordon College CCS community in Olongapo City. It includes public event browsing, student accounts and bookings, and a protected administrator workspace. Event information is stored in SQLite; a new installation starts empty and never seeds invented events.

## Requirements

- Node.js 24 or later (uses built-in `node:sqlite`)
- npm (ships with Node)

No third-party packages are required for the current implementation.

## Run locally

```powershell
Copy-Item .env.example .env
npm start
```

The first run creates the database at `./data/sportshub.sqlite`. In development it serves at `http://localhost:3000`.

Create the first administrator from an interactive terminal, before or after first startup:

```powershell
npm run admin:bootstrap
```

The bootstrap refuses to create a second initial administrator and reads the password without echoing it. Keep the local database private. Public self-registration creates student accounts only.

If you forget an admin email or password, run `npm run admin:recover` from the project root in an interactive terminal. It lists admin emails, requires you to select and confirm the account, then sets a new password without displaying it. Existing sessions for that account are revoked. This command has local database access and must only be run by a trusted operator on the machine hosting the app.

## Current capabilities

- Public landing page, searchable event discovery, event details, empty/error states, and an OpenStreetMap view for events whose coordinates an administrator has verified.
- Student registration/sign-in, editable display name and sports interests, private booking history, booking cancellation, and in-app notifications.
- Participant and spectator booking types with separate capacities, duplicate prevention, transactional capacity checks, optional administrator review, and status notifications.
- Protected admin event creation/editing, draft/publish/cancel/archive status, data-derived metrics, pending booking decisions, and audit records for event and booking changes.
- Responsive orange, charcoal, white, and gray interface. No events or locations are fabricated or seeded automatically.

## Known limitations

- Google OAuth/OpenID Connect is not integrated. Current accounts use email and password; enrollment at Gordon College is not verified by this app. A maintained OIDC integration and owner-controlled Google OAuth setup are still required before the requested Google sign-in flow is available.
- This is a development implementation. The in-memory rate limiter is per process, and there is no email verification/recovery, production deployment setup, external monitoring, or multi-instance session store.
- The map uses OpenStreetMap's public embedded map service and requires network access. It displays only event coordinates entered by an administrator; it does not request user geolocation.
- Event images, file uploads, waitlists, exports, and automated email are not implemented.
- SQLite persistence is suitable for local/single-instance development; production scale and backup/restore procedures have not been established.

## Checks

```powershell
npm run check
npm test
```

These validate source syntax and exercise local registration, session cookies, role denial, event management, separate participant/spectator capacity, concurrent attempts for the last participant place, admin booking decisions, capacity release on cancellation, event cancellation notices, and CSRF rejection. They do not verify Google sign-in, enrollment, map-service availability, production security, or deployment. There is no separate compilation/build script because the app uses native Node modules and static browser files.

## Project structure

- `src/server.js` — HTTP routes, authorization, event/booking rules, and static file serving.
- `src/db.js` — SQLite schema, indexes, startup migration, and transaction helper.
- `src/auth.js` — password hashing, opaque sessions, CSRF checks, and throttling.
- `src/bootstrap-admin.js` — first-admin CLI.
- `public/` — accessible responsive UI and browser behavior.
- `tests/app.test.js` — isolated end-to-end API test using a temporary database.
- `docs/REPOSITORY_AUDIT.md` — implementation state, security gaps, and evidence.

## Configuration

Copy `.env.example` to `.env`. Current supported values are `PORT`, `DATABASE_PATH`, and `NODE_ENV`. Keep `.env` and the database file private; neither is tracked by Git. Google OAuth variables are not listed because that integration is not yet implemented.
