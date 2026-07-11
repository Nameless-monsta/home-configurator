# ADR-005 — Persistent Single WebGL Stage

**Status:** Accepted

## Context

Room and device transitions must feel continuous. Recreating a canvas per route would cause loading, flicker, state loss and memory churn.

## Decision

Create one renderer per mounted custom view and retain it across navigation. Routes request model, camera and presentation transitions through the renderer controller.

## Consequences

- Strong continuity and asset reuse.
- Strict resource lifecycle and disposal requirements.
- Renderer failure requires a 2D fallback boundary.
