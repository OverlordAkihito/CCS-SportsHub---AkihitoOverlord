# Architecture Record

## Evidence status at bootstrap

The app architecture cannot be established from the supplied keeper-kit directory; current app architecture remains unknown pending the actual application checkout.

## Inspected current state

This directory is a context-keeper kit, not the application repository (`README.md`; root inventory documented in `docs/REPOSITORY_AUDIT.md`). Its visible tooling consists of Python scripts:

- `scripts/context_sync.py` reads Git metadata and filesystem path metadata to generate `context/AUTO_STATE.md`; its source states that it does not read source/configuration contents.
- `scripts/context_validate.py` checks keeper-file presence and required text. It does not validate app behavior.
- `scripts/context_watch.py` is listed in the kit README as an optional context snapshot watcher; it is not an application service.

No app entry points, manifests, schema, migrations, backend, identity/session code, storage, or provider configuration were found in this directory. The actual application architecture is **unknown** because the app checkout is absent. See `docs/REPOSITORY_AUDIT.md` for inventory and check results.

## Open decisions

No application architecture decisions can be made from this kit. Persistence, auth, hosting, realtime transport, payment, and external backup choices remain open unless established in the actual application repository or by its owner.

## Guardrails

1. Do not infer application architecture or features from the product brief or keeper utilities.
2. Do not select a framework, backend, database, provider, or host without repository evidence or an explicit owner decision.
3. Sensitive authorization must be enforced at a trusted backend/service boundary.
4. Record proposed target architecture separately from verified current facts.

## After app checkout is available

Audit real source, tests, manifests, configuration names, schemas/migrations, and trusted service boundaries. Then write the target decision and dependency-aware roadmap in `docs/ARCHITECTURE_DECISIONS.md`, keeping proposals distinct from current-state facts.
