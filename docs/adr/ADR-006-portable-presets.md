# ADR-006 — Portable Versioned Presets

**Status:** Accepted

## Context

A reusable product cannot export one installation's entity IDs as its sharing format.

## Decision

Presets describe rooms, device profiles, capability requirements, presentation and mapping placeholders. Import resolves these requirements against local discovery and requires review for ambiguous matches.

## Consequences

- Installations remain portable.
- Import requires a mapping and validation workflow.
- Presets and runtime documents have independent schema versions.
