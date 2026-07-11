# ADR-002 — Capability-Driven Internal Model

**Status:** Accepted

## Context

Home Assistant domains and integrations expose inconsistent entities and attributes. Renderer components should not depend on manufacturer-specific or domain-specific implementation details.

## Decision

Normalize devices into capability-driven profiles. UI controls and renderers consume capabilities and semantic commands rather than raw entities or services.

## Consequences

- Better portability across manufacturers and integrations.
- More initial work in detection and normalization.
- New capabilities can be added without restructuring the renderer.
