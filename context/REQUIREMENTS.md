# Requirements Register

Statuses below refer to the current local implementation and are supported by the code paths and checks in `docs/REPOSITORY_AUDIT.md`. They do not imply production readiness.

## Status vocabulary

`Implemented` means the behavior has evidence-backed code and appropriate checks; `Partial` means an important path exists but scope or verification remains; `UI-only` means controls exist without verified underlying behavior; `Missing` means the inspected implementation lacks the feature; `Unable to verify` means evidence/access is insufficient; `Blocked` identifies a concrete external dependency; `Not applicable` requires an explicit rationale.

| ID | Requirement | Status | Evidence / remaining gap |
|---|---|---|---|
| SH-01 | Public landing page with truthful data-backed upcoming events and empty states | Partial | `public/index.html`, `public/app.js`; zero published events render an empty state. Categories are not data-driven. |
| SH-02 | Search and filter published events | Partial | `/api/events` and browser filters cover title/sport/venue plus sport/type; date/availability filters and pagination are not implemented. |
| SH-03 | Event details, organizer, schedule, venue, eligibility, booking options | Partial | `GET /api/events/:slug`; no event image or full status history. |
| SH-04 | Map showing verified event coordinates without user tracking | Partial | OSM embedded map displays entered coordinates with attribution; no marker clustering, synchronized filters, or offline map. |
| SH-05 | Google OAuth/OIDC and secure app sessions | Partial | Local email/password, scrypt password hashes, opaque DB-backed session cookie, expiry, logout, CSRF token and role loading are implemented in `src/auth.js`; Google OAuth, email verification/recovery, and provider callback flow are absent. |
| SH-06 | Server-controlled student/admin roles and protected admin operations | Partial | `src/server.js` checks session role; `src/bootstrap-admin.js` creates only the first admin. Enrollment and admin identity are not verified externally. |
| SH-07 | Student dashboard, profile, booking history, updates | Partial | `/api/my/*` scopes records to session user; display name/interests editable. Profile image, separate status filters, and full update history are absent. |
| SH-08 | Participant and spectator booking with independent capacities | Partial | Transactional `BEGIN IMMEDIATE`, duplicate unique constraint, distinct capacities and booking policy in `src/server.js`/`src/db.js`; no waitlist or schedule edit conflict recovery flow beyond request error. |
| SH-09 | Admin event creation/edit/publish/cancel/archive | Partial | Protected event endpoints and UI; consequential cancellation prompt and in-app notifications are implemented. No delete, image upload, venue manager, or advanced sorting/pagination. |
| SH-10 | Admin booking review and decisions | Partial | Approve/reject pending requests, audit records, and recipient notification; limited participant details and no bulk operations. |
| SH-11 | Event-change notifications | Partial | Private in-app notices for booking decisions/cancellation/schedule/status changes; no push or email. |
| SH-12 | Data-backed admin metrics | Partial | Counts derive from SQLite; no historical analytics, exports, or detailed capacity reports. |
| SH-13 | Accessibility and responsive behavior | Partial | Semantic controls, labels, reduced-motion CSS, mobile layout, loading/empty/error feedback; WCAG audit and broad device testing not completed. |
| SH-14 | Setup, configuration, tests and deployment docs | Partial | README, `.env.example`, and isolated end-to-end tests exist; no production deployment, backup/restore, monitoring, or credential setup evidence. |

## Priority blockers

1. Add Google OIDC through a maintained library and owner-provided OAuth client/callback configuration.
2. Decide how Gordon College enrollment and admin eligibility are verified; Google identity alone does not establish enrollment.
3. Define production persistence, session/rate-limit strategy, backup/recovery, deployment, monitoring, and operational admin provisioning.
