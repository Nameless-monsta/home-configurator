# Phase 4 — Development

**Status:** In progress  
**Entry gate:** Phase 3.5 approved

## Workstream

- [x] **4.1 Repository, build and CI setup**
- [x] **4.2 Runtime Core**
- [x] **4.3 Graphics Engine**
- [x] **4.4 Interaction Engine**
- [x] **4.5 Home Assistant Engine**
- [x] **4.6 UI Engine**
  - [x] **4.6.1 UI Foundation**
  - [x] **4.6.2 Navigation System**
  - [x] **4.6.3 Configurator Framework**
  - [x] **4.6.4 Control Library**
  - [x] **4.6.5 Device Panels**
  - [x] **4.6.6 iyO Motion System**
  - [x] **4.6.7 Responsive Behaviour**
  - [x] **4.6.8 UI Validation and Merge**
- [ ] **4.7 First Interactive Prototype**
  - [x] **4.7.1 Prototype Command Bridge**
  - [ ] **4.7.2 Authoritative State and Model Binding**
    - [ ] **4.7.2.1 Runtime Device Store**
    - [ ] **4.7.2.2 Home Assistant State Adapter**
    - [ ] **4.7.2.3 Selected-Device Model Binding**
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

Authenticated WebSocket transport, automatic room and device discovery, capability abstraction, live state synchronisation, command translation, optimistic reconciliation, reconnect behaviour and diagnostics. GitHub Actions validation passed formatting, linting, strict TypeScript, tests and production builds.

See [4.5 Home Assistant Engine](4.5_HOME_ASSISTANT_ENGINE.md).

### 4.6 — UI Engine

Full-screen shell, navigation, capability-driven configurator, control library, device panels, iyO motion orchestration, responsive behaviour and accessibility validation are integrated into one dashboard surface. All 4.6.1–4.6.8 reports are closed and CI validated.

See the 4.6.1–4.6.8 implementation reports in this directory.

### 4.7.1 — Prototype Command Bridge

Semantic Home Assistant command dispatch is integrated into the configurator. Pull request #18 passed the full validation pipeline and was merged into `main`.

See [4.7.1 Prototype Command Bridge](4.7.1_PROTOTYPE_COMMAND_BRIDGE.md).

## Active milestone

### 4.7.2.1 — Runtime Device Store

Introduce an application-owned state package with confirmed, optimistic and effective device state, indexed lookup, fine-grained subscriptions, central selection, bounded transition history and diagnostics.

See [4.7.2.1 Runtime Device Store](4.7.2.1_RUNTIME_DEVICE_STORE.md).

## Required validation command

```bash
pnpm check
```

This runs formatting, linting, type checking, tests and builds across the workspace.

## Development rule

Implementation must follow the approved Phase 2 architecture, Phase 3 UX contracts and Phase 3.5 engineering specifications. Any change to runtime ownership or public contracts requires an ADR and an update to the corresponding specification.
