# Phase 4 — Development

**Status:** In progress  
**Entry gate:** Phase 3.5 approved

## Workstream

- [x] **4.1 Repository, build and CI setup**
- [x] **4.2 Runtime Core**
- [x] **4.3 Graphics Engine**
- [x] **4.4 Interaction Engine**
- [x] **4.5 Home Assistant Engine**
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

### 4.4 — Interaction Engine

Central input ownership, semantic raycasting, gesture arbitration, selection, navigation, transitions, animations, camera focus and accessible keyboard alternatives. GitHub Actions validation passed formatting, linting, strict TypeScript, tests and production builds.

See [4.4 Interaction Engine](4.4_INTERACTION_ENGINE.md).

### 4.5 — Home Assistant Engine

Authenticated WebSocket transport, automatic room and device discovery, capability abstraction, live state synchronization, command translation, optimistic reconciliation, reconnect behavior and diagnostics. GitHub Actions validation passed formatting, linting, strict TypeScript, tests and production builds.

See [4.5 Home Assistant Engine](4.5_HOME_ASSISTANT_ENGINE.md).

## Next milestone

### 4.6 — UI Engine

The UI milestone will compose the approved iyO-inspired navigation, overlays, configurator controls, responsive shell and accessibility layer over the runtime, graphics, interaction and Home Assistant engines.

## Required validation command

```bash
pnpm check
```

This runs formatting, linting, type checking, tests and builds across the workspace.

## Development rule

Implementation must follow the approved Phase 2 architecture, Phase 3 UX contracts and Phase 3.5 engineering specifications. Any change to runtime ownership or public contracts requires an ADR and an update to the corresponding specification.
