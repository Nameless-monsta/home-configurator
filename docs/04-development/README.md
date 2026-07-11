# Phase 4 — Development

**Status:** In progress  
**Entry gate:** Phase 3.5 approved

## Workstream

- [x] **4.1 Repository, build and CI setup**
- [x] **4.2 Runtime Core**
- [x] **4.3 Graphics Engine**
- [ ] **4.4 Interaction Engine — implementation complete, CI validation running**
- [ ] **4.5 Home Assistant Engine**
- [ ] **4.6 UI Engine**
- [ ] **4.7 First Interactive Prototype**
- [ ] **4.8 Performance optimisation**
- [ ] **4.9 Documentation**
- [ ] **4.10 HACS release**

## Completed milestones

### 4.1 — Repository, build and CI setup

Node.js 22, pnpm workspaces, Turbo, strict TypeScript, ESLint, Prettier, Vitest and GitHub Actions validation.

### 4.2 — Runtime Core

Deterministic lifecycle, dependency injection, event bus, scheduler, diagnostics, configuration, plugin and asset managers, plus the Home Assistant adapter boundary.

See [4.2 Runtime Core](4.2_RUNTIME_CORE.md).

### 4.3 — Graphics Engine

Persistent Three.js stage, responsive camera, scene graph, studio lighting, quality tiers, GLTF loader, fallback hero, diagnostics and dashboard integration.

See [4.3 Graphics Engine](4.3_GRAPHICS_ENGINE.md).

## Active milestone

### 4.4 — Interaction Engine

Central input ownership, semantic raycasting, gesture arbitration, selection, navigation, transitions, animations, camera focus and accessible keyboard alternatives.

See [4.4 Interaction Engine](4.4_INTERACTION_ENGINE.md).

## Required validation command

```bash
pnpm check
```

This runs formatting, linting, type checking, tests and builds across the workspace.

## Development rule

Implementation must follow the approved Phase 2 architecture, Phase 3 UX contracts and Phase 3.5 engineering specifications. Any change to runtime ownership or public contracts requires an ADR and an update to the corresponding specification.
