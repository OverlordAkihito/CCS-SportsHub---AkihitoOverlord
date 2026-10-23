# Project Overview

## Purpose

Sportshub helps Computer Studies and Computer Science students at Gordon College in Olongapo City discover sports events and tryouts, review venue/schedule/eligibility information, and book participant or spectator places when offered. Authorized administrators manage event details and booking decisions.

## Current product state

This directory now contains a greenfield implementation built on Node.js 24, Node's built-in HTTP server and SQLite module, and a browser-based responsive interface. The implementation and evidence boundaries are tracked in `docs/REPOSITORY_AUDIT.md` and `context/ARCHITECTURE.md`.

The local app currently supports password-based student/admin sessions and the core event and booking flows. Google OAuth/OIDC, enrollment verification, email recovery, and production deployment are not implemented or configured. Empty databases show empty states; no sample events or locations are fabricated.

## Product principles

1. Persist events and bookings in the trusted server/database layer.
2. Enforce student ownership and administrator roles server-side.
3. Keep participant and spectator capacities independent and concurrency-safe.
4. Use only administrator-entered event coordinates; never fabricate map points or request user location.
5. Treat provider integration and college enrollment verification as distinct questions.
6. Keep implementation status tied to observed source and tests.
