# Security and Privacy Context

## Identity and authorization

Establish identity through a trusted configured authentication flow; never trust client-supplied user identity or roles as proof. Enforce sensitive access rules at trusted backend/service boundaries and test denied paths.

## Design invariants for the intended application

These are constraints for future app work, not claims that the current app satisfies them:

- Establish identity through a trusted configured authentication flow; never trust client-supplied user identity or roles as proof.
- Keep privileged credentials out of browser code, committed files, logs, and context documents.
- Enforce sensitive access rules at trusted backend/service boundaries and test denied paths.
- Prevent cross-user access to private records; document ownership, deletion, retention, restore, and audit behavior.
- Make location sharing explicit, opt-in, minimal, and privacy-aware. QR links must not encode secrets.
- Protect moderation, subscription entitlements, backup, and restore with trusted authorization and auditability.
- Never expose existing passwords or silently overwrite production data from unverified backups.

## Current audit result

The inspected directory is a keeper kit with no application source, backend, auth implementation, or provider configuration (`docs/REPOSITORY_AUDIT.md`). Thus the application's security/privacy posture is **Unable to verify**. The Critical/High entries in the audit are assessment gaps caused by missing source, not verified vulnerabilities in the absent application. No secret values or production records were inspected or recorded.

## Follow-up when the app checkout is available

Trace each sensitive flow from UI through data access to the trusted boundary, inspect configuration variable names without printing values, and test permitted and denied paths where safe. Record unresolved evidence as a gap, not a pass.
