# Decision Register

This file stores durable decisions, not assumptions disguised as facts. Add an ID, status, date, rationale, consequences, and evidence/context for future decisions. Mark superseded decisions instead of erasing history.

## D-001 — Requirements are not implementation evidence

- **Status:** Confirmed operating rule
- **Decision:** Treat app feature descriptions as desired product behavior until repository inspection and relevant checks establish the actual state.
- **Rationale:** The supplied development guide explicitly requires a repository audit and warns against assuming a feature works because a UI element exists.
- **Consequences:** Audit features through UI, data access, identity/authorization and trusted backend boundaries where possible; use evidence-based statuses in `REQUIREMENTS.md`.

## D-002 — Repository-first development

- **Status:** Confirmed operating rule
- **Decision:** Inspect the actual repository before choosing architecture, dependencies, implementation sequence, or code patterns.
- **Rationale:** Prevents guessed frameworks/providers and unnecessary rewrites.
- **Consequences:** First initialization is audit-only; architecture and roadmap follow the audit.

## D-003 — No silent provider selection

- **Status:** Confirmed operating rule
- **Decision:** Do not silently pick auth, database, hosting, realtime, payment or external backup providers where the repo/configuration and owner have not established a choice.
- **Rationale:** Such choices affect security, cost, deployment, privacy and migration.
- **Consequences:** Complete provider-independent safe work if useful and record the exact choice/configuration needed.

## D-004 — Sensitive authorization must be trusted

- **Status:** Confirmed security rule
- **Decision:** Browser visibility or editable client state is not an authorization boundary.
- **Rationale:** Multi-user data, admin operations, private messages, moderation, subscriptions and backups require access control that cannot be bypassed by calling APIs directly.
- **Consequences:** Trace and test both permitted and denied operations at the trusted service boundary.

## D-005 — Smallest coherent safe change

- **Status:** Confirmed engineering rule
- **Decision:** Preserve sound existing behavior and make the smallest complete change that satisfies the task; avoid unrelated rewrites, duplicate systems, and unnecessary dependencies.
- **Rationale:** Improves maintainability and reduces regressions.
- **Consequences:** Expand scope only when dependencies, security, correctness or acceptance criteria require it.

## D-006 — Evidence-based validation reports

- **Status:** Confirmed operating rule
- **Decision:** Report checks as PASS/FAIL/NOT RUN using actual commands/results; do not infer success from intention or from unrelated earlier runs.
- **Rationale:** Makes the handoff reliable and avoids false completion claims.
- **Consequences:** Record environment/credential blockers and concrete next checks.

## App-specific technical decisions

No concrete stack/provider/schema/hosting/payment/realtime/storage decision has been confirmed in the keeper source materials. Add decisions here only after repository evidence or an explicit owner decision exists. Link detailed architecture proposals to `docs/ARCHITECTURE_DECISIONS.md` when created.
