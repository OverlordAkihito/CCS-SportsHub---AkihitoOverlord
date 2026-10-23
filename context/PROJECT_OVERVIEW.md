# Project Overview

## Purpose described by the keeper

The product brief describes a multi-user social/community application with profiles, relationships, messaging, account administration, moderation, privacy controls, subscription-state visibility, and data recovery. These remain intended goals, not verified application behavior.

## Inspected directory

The current directory is a context-keeper kit, not the application checkout. Root `README.md` describes the kit's purpose and explicitly says application source was not included. Inventory evidence is recorded in `docs/REPOSITORY_AUDIT.md`.

## Evidence boundary

The app's language, framework, entry points, backend, persistence, identity provider, hosting, integrations, and feature states remain unknown because app source/configuration is absent. Do not infer app architecture or feature status from the keeper's product brief or tooling.

## Product principles

1. Multi-user isolation and trusted authorization must be real; hiding a control in the browser is not security.
2. Keep the smallest coherent architecture capable of required features and preserve working behavior.
3. Privacy settings and consent must affect actual data returned and actions allowed.
4. Security-sensitive capabilities require evidence-based validation.
5. Unconfigured integrations must be labeled unconfigured.
6. Feature implementation should follow prerequisites and actual repository state.
7. Each meaningful task should leave accurate context for the next session.

## Next step

Run the first-run audit from the actual app repository root, then establish current architecture and a dependency-aware roadmap from source evidence.
