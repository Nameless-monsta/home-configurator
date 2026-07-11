# ADR-003 — Optional Backend Integration

**Status:** Accepted

## Context

Persistent configuration, model metadata and optimized discovery benefit from a backend integration, but requiring it would increase installation friction and coupling.

## Decision

The frontend must operate independently. The optional integration adds storage, discovery helpers, migrations, diagnostics and WebSocket APIs.

## Consequences

- Graceful frontend-only mode.
- More compatibility paths to test.
- Backend failure cannot make the dashboard unusable.
