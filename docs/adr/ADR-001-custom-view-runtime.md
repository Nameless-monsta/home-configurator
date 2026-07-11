# ADR-001 — Canonical Runtime Is a Custom View

**Status:** Accepted

## Context

The product requires a persistent full-viewport 3D stage and coordinated shell. Standard Lovelace layouts constrain composition and encourage card-based rendering.

## Decision

Use a Home Assistant custom view as the canonical runtime. Provide a custom card only for launching, previewing and constrained embedding.

## Consequences

- Full control of view composition and renderer lifecycle.
- More responsibility for routing, accessibility and responsive behavior.
- Cleaner separation from conventional Lovelace cards.
