# Security and Privacy Context

## Identity and authorization

Current password identity, database-backed sessions, server role checks, ownership scoping, and CSRF controls are described below. Google OIDC and enrollment verification remain unimplemented.

## Current protections

- `src/auth.js` hashes passwords with scrypt and salts; session cookies are HttpOnly, SameSite=Lax, opaque, and stored in SQLite as SHA-256 hashes with expiry.
- Mutating authenticated requests require a session-bound CSRF token; request origins are checked when present.
- `src/server.js` enforces admin role checks and scopes student bookings, profile edits, and notices to the authenticated user. Roles and ownership are never accepted from ordinary profile input.
- SQLite enforces foreign keys, allowed role/status values, unique user/event/booking-type records, and nonnegative capacities. Booking creation uses a write transaction to protect capacity under concurrency.
- Admin event/booking actions are recorded in `audit_log`; booking and event-change notifications are recipient-scoped.
- Event coordinates are required to be valid, or the administrator must explicitly mark location unavailable before publishing. The app does not request user geolocation.
- `.env`, local SQLite files, and local data directories are ignored by Git; no secret values or user data are committed.

## Known risks and gaps

- Google OAuth/OIDC, email verification/recovery, and college enrollment verification are absent. Password account ownership is not externally verified.
- The first admin is created from a local terminal; production operator identity and protected server access are not established.
- Rate limiting is process-local and can be bypassed across instances/restarts. There is no monitoring, security review, backup/restore testing, or production deployment evidence.
- The server has no configured HTTPS terminator. Secure cookies activate only when `NODE_ENV=production`; deployment must provide HTTPS and correct proxy handling.
- The OSM iframe sends a network request to OpenStreetMap when a verified event map is displayed; no browser geolocation is requested.
- This is not a completed security assessment. See ranked limitations in `docs/REPOSITORY_AUDIT.md`.
