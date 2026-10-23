# Development Sequence and Release Checks

Use the sequence as a default dependency order, not as a blind checklist. First inspect `docs/REPOSITORY_AUDIT.md` and the code. Mark items already correctly implemented, skip features that are out of scope, and adapt the order when real dependencies justify it. This sequence reflects the supplied app development guide.

## Phase 1 — Discover before building

1. **Repository audit** — read-first; produce/update `docs/REPOSITORY_AUDIT.md`; do not change application behavior in the audit task. Establish stack, structure, storage/backend/auth, feature state, ranked risks, commands/results and unknowns. Cite paths/symbols. Status choices: Implemented, Partial, UI-only, Missing, Unable to verify.
2. **Architecture decision** — after audit, create/update `docs/ARCHITECTURE_DECISIONS.md`. Separate existing facts from proposed target; define trusted boundaries, data ownership, authz, storage/backup, chat/realtime if required, provider choices, deployment and migration.
3. **Dependency-aware roadmap** — create/update `docs/IMPLEMENTATION_ROADMAP.md`. Include task, state/evidence, dependencies, acceptance, risk and prompt; distinguish launch scope and optional/deferred scope. Do not invent deadlines or guarantees.

## Phase 2 — Foundation, identity, security

4. Trusted backend/data foundation and data model, if needed (avoid a duplicate backend if a sound one exists).
5. Google sign-in/session lifecycle, if required/configured.
6. Roles, trusted permissions, account lockout/rate limiting and recovery.
7. Stable public account IDs, account settings and privacy-safe people search.

## Phase 3 — User-facing core features

8. Profile editing and profile photo crop/reposition/rotate/delete.
9. Add/connect, likes/unlikes, profile interactions and message entry points; document relationship semantics.
10. QR profile links that open stable public routes and obey privacy.
11. Supported chat modes (announcements/global/nearby/DM) with trusted sender identity, per-room/conversation permissions, bounded history and abuse controls.
12. Opt-in location privacy and nearby chat; location permissions/privacy must affect service results, not only UI.
13. Navigation placement and accessible collapsible cards; move earlier if current layout blocks foundation work.
14. Confirmation, trash, restore and permanent deletion semantics.

## Phase 4 — Administration, trust, billing state and recovery

15. Admin dashboard/account management with server-verified privileges, pagination, protected actions and audit trail.
16. Reports/moderation workflow with role-gated review, privacy and traceable status transitions.
17. Subscription-state model/visibility; keep it distinct from roles and tags. Treat payment provider integration as optional and only after selection/configuration.
18. Per-user data isolation and backup/restore with access control, validation, versioning, recovery point and truthful provider confirmation.

## Phase 5 — Quality, delivery and maintenance

19. Security/privacy review (repeat after major trust-boundary changes).
20. Add/broaden automated tests continuously; document exact commands and coverage gaps in `docs/TESTING.md`.
21. Diagnose bugs with evidence; optimize only measured or clearly evidenced bottlenecks.
22. Update developer docs/handoff to match real code.
23. Run the release gate.
24. Prepare deployment/configuration based on the actual environment. Do not deploy or alter production without authorization.

Use focused maintenance tasks for small bug fixes, changes, performance, documentation, refactoring, library investigation, UI-control tracing, feature review, or frontend-prototype migration when those needs arise. Do not execute every prompt from a library without first verifying it is relevant.

## App-specific release/acceptance checklist

Mark an item PASS only with evidence; use FAIL or NOT RUN when appropriate.

- [ ] Authentication identity is validated by the trusted auth system; expiry/revocation are handled.
- [ ] No private/service-role secret or privileged credential is exposed in client-side code.
- [ ] Admin operations are trusted-server authorized; direct unauthorized requests fail.
- [ ] Passwords are not exposed to admins; resets use recovery flow.
- [ ] Ownership/isolation is enforced for profiles, settings, messages, reports and backups.
- [ ] Public IDs are stable/unique; search reveals approved fields and has suitable abuse protection.
- [ ] Photo upload/crop/rotate/delete works; saved output matches preview; cancel/errors behave safely.
- [ ] QR links contain no secrets and obey public/private/suspended/deleted profile rules.
- [ ] Chat authorization is enforced per room/conversation; ordinary users cannot forge admin/system announcements.
- [ ] Nearby chat respects opt-in, private settings, denied/revoked permission and data minimization.
- [ ] Reports and admin review have distinct permissions and audit history.
- [ ] Timed bans and account lockout/rate limits behave correctly without easy denial-of-service.
- [ ] Cosmetic tags do not grant actual roles or privileges.
- [ ] Subscription entitlements come from a trusted source; frontend flags cannot unlock paid features.
- [ ] Cancel, trash, restore and permanent deletion have distinct meanings and correct authorization/recovery.
- [ ] Backup is access-controlled; restore validates data, is authorized/audited and has a recovery plan.
- [ ] Important flows cover loading/empty/error/invalid/permission-denied states.
- [ ] Navigation/collapsible cards work on supported screen sizes and with keyboard/assistive technology.
- [ ] Reproducible tests are accurately reported PASS/FAIL/NOT RUN with exact evidence.
- [ ] Setup, environment names, migration, backup, rollback, and deployment guidance match the actual repository.

## Release gate output

Create/update `docs/RELEASE_CHECKLIST.md` when the release gate is run. For each relevant item record PASS / FAIL / NOT RUN, evidence, and severity/owner for blockers. Fix clear in-scope release blockers; do not mislabel unverified items as passing.
