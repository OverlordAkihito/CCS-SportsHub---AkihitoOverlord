# Requirements Register

**Interpretation rule:** The entries below are product requirements/goals compiled from the supplied development guide. The inspected directory is a context-keeper kit, not the application repository; therefore **current implementation status for all app capabilities remains Unable to verify**. This does not establish that the app lacks those features. See `docs/REPOSITORY_AUDIT.md`. Do not promote a feature to implemented based only on a label, screen, button, local-storage entry, or mock response.

## Status vocabulary

Use `Verified`, `Partial`, `UI-only`, `Missing`, `Unable to verify`, `Blocked`, or `Not applicable`. Every status change should include evidence (paths/symbols, tests, or observed behavior) and material gaps.

| ID | Requirement area | Expected behavior / acceptance summary | Initial status |
|---|---|---|---|
| REQ-01 | Identity and sessions | Google sign-in where selected/configured; trusted identity validation; secure sign-in/out, expiry, refresh/revocation and recovery; no client-supplied identity trusted as proof. | Unable to verify — app repository absent; audit required |
| REQ-02 | Multi-user data isolation | Users can access only authorized records; ownership enforced at a trusted service/backend boundary for private profiles, settings, chats, reports, backups and other sensitive data. | Unable to verify — repository audit required |
| REQ-03 | Roles and account protection | User/admin/moderator/owner roles only where needed; server-side permissions; rate limits and proportionate lockout; account recovery; no password visibility to admins. | Unable to verify — repository audit required |
| REQ-04 | Account management | Authorized listing/search, account state management, permitted profile editing, deactivation/suspension/deletion behavior, timed bans and audit events. | Unable to verify — repository audit required |
| REQ-05 | Public user ID and people search | Stable, unique public-facing ID; copy action; normalized/validated search; privacy-limited results and abuse protection. | Unable to verify — repository audit required |
| REQ-06 | User profiles | Authorized editing of approved public fields; privacy rules applied to profile reads; cannot edit another user's profile. | Unable to verify — repository audit required |
| REQ-07 | Profile photo tools | Upload, crop/reposition, rotate, save and delete; safe type/size validation; preview matches saved circular avatar; errors/cancel are handled. | Unable to verify — repository audit required |
| REQ-08 | Social interactions | Add/connect, view profile, like/unlike, and message entry points where in scope; clear relationship semantics; no self-add/self-like, duplicates, or unauthorized edits. | Unable to verify — repository audit required |
| REQ-09 | QR profile links | Stable public profile URL/identifier, correct destination, no secrets in QR; private/suspended/deleted account behavior obeys access rules. | Unable to verify — repository audit required |
| REQ-10 | Chat modes | Implement only required/supported announcements, global chat, nearby chat, and direct messages; bound/paginated history, trusted sender identity, per-room/conversation authorization and abuse controls. | Unable to verify — repository audit required |
| REQ-11 | Location privacy / nearby chat | Explicit opt-in and clear disclosure; public/private preference affects server results; minimum necessary precision/retention; permission denied/revoked/stale cases handled; no covert tracking. | Unable to verify — repository audit required |
| REQ-12 | Reports and moderation | Report reasons/status transitions, private reviewer notes, reviewer permissions, spam/duplicate protection, traceable moderation actions and audit history. | Unable to verify — repository audit required |
| REQ-13 | Navigation and collapsible cards | Supported navigation placement/layout configuration and accessible, keyboard-operable, responsive collapsible areas. | Unable to verify — repository audit required |
| REQ-14 | Deletion, trash and restore | Clear choice/semantics for cancel, trash, restore and permanent deletion; ownership/authorization; confirmation; recovery policy and dependent-data handling. | Unable to verify — repository audit required |
| REQ-15 | Subscription-state visibility | Clear state model for free/paid/past-due/cancelled/expired/pending where needed; state source, timestamps and entitlements are trusted and auditable. | Unable to verify — repository audit required |
| REQ-16 | Payment provider | Optional. Integrate only after a provider is chosen and configured; no silent provider choice, payment-secret storage, or browser-only entitlement grants. | Optional; configuration/provider unknown |
| REQ-17 | Backup and recovery | Define backup scope/retention/access control/versioning; per-user and/or system recovery as appropriate; validate restore, protect current data, authorize/audit privileged recovery, and report provider success only after confirmation. | Unable to verify — repository audit required |
| REQ-18 | Reliability and UX states | Important flows handle loading, empty, success, invalid input, permission denial, network failure, server errors, concurrency/repeat submissions, large lists/history and accessibility. | Unable to verify — repository audit required |
| REQ-19 | Testing and release | Reproducible focused tests plus relevant lint/type/build/security checks; truthful PASS/FAIL/NOT RUN reporting; documented gaps and release blockers. | Unable to verify — repository audit required |
| REQ-20 | Setup and deployment | Commands/configuration documented from actual files; environment examples contain placeholders only; migration/backup/rollback limitations are explicit; deployment is not implied without execution/evidence. | Unable to verify — repository audit required |
| REQ-21 | Navigation/context continuity | Each meaningful work session updates relevant context, current work state, handoff, and generated repository snapshot so the next agent can recover reliably. | Partial — keeper files/scripts exist here; app-repository adoption is unverified. Python scripts could not be run because Python is unavailable. |

## Requirements change policy

- Preserve the user's intended behavior; clarify only when a decision materially affects safety, data semantics, provider selection, or irreversible consequences.
- If a requirement conflicts with current implementation, record the conflict and recommend a migration path; do not silently redefine either side.
- When a feature is complete, cite evidence and tests, note limits, and update both the status here and the relevant architecture/security docs.
- Features may be deferred or ruled out only with an explicit rationale. Do not run every prompt in a prompt library blindly.
