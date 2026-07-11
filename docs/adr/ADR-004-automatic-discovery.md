# ADR-004 — Automatic Discovery by Default

**Status:** Accepted

## Context

Manual entity-by-entity setup would make the product difficult to adopt and distribute.

## Decision

Read Home Assistant area, floor, device and entity registries to generate rooms and visual devices automatically. Preserve user overrides and require review for low-confidence assignments.

## Consequences

- Useful first-run experience.
- Need for reconciliation, confidence scoring and admission workflows.
- Discovery must remain explainable and non-destructive.
