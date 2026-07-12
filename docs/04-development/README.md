# Phase 4 — Engine, Runtime and Technical Prototype

**Status:** Engineering implementation substantially complete  
**Entry gate:** Phase 3.5 approved  
**Exit note:** Physical sustained-device profiling remains required before beta acceptance

## Purpose

Phase 4 built the technical foundation required by the product: runtime ownership, Home Assistant integration, graphics, interaction, state reconciliation, technical UI scaffolding, diagnostics and performance controls.

Phase 4 did **not** complete the polished iyO-inspired product interface. The Phase 3 UX work is an approved specification; faithful visual implementation is the responsibility of Phase 5 Product Experience.

## Workstream

- [x] **4.1 Repository, build and CI setup**
- [x] **4.2 Runtime Core**
- [x] **4.3 Graphics Engine**
- [x] **4.4 Interaction Engine**
- [x] **4.5 Home Assistant Engine**
- [x] **4.6 UI Engine foundation**
  - [x] UI Foundation
  - [x] Navigation System
  - [x] Configurator Framework
  - [x] Control Library
  - [x] Device Panels
  - [x] iyO Motion primitives
  - [x] Responsive Behaviour
  - [x] UI Validation
- [x] **4.7 Technical Interactive Prototype**
  - [x] Prototype Command Bridge
  - [x] Authoritative State and Model Binding
  - [x] Colour and brightness gesture plumbing
  - [x] Prototype validation contracts
- [x] **4.8 Performance implementation**
  - [x] Adaptive quality
  - [x] Frame and renderer observability
  - [x] Long-task monitoring
  - [x] Resource-pressure response
  - [x] Bounded model asset cache
- [ ] **Physical sustained-device profiling**

## What Phase 4 proves

The repository can support a production application with:

- deterministic runtime and state ownership;
- automatic Home Assistant discovery and semantic commands;
- optimistic confirmation and rollback;
- a persistent Three.js stage;
- selected-device model binding;
- gesture input and accessible alternatives;
- responsive and reduced-motion contracts;
- adaptive quality and resource budgets;
- bounded asset caching and diagnostics.

## What Phase 4 does not prove

Phase 4 does not prove that the current dashboard is the intended finished product. It does not yet provide:

- a faithful iyO-inspired spatial shell;
- production typography, glass, depth and motion;
- a true spatial colour sphere;
- cinematic room navigation;
- production-quality room and device assets;
- a reviewable build that visually represents the final ambition.

Those items are tracked in [Phase 5 — Product Experience](../05-product-experience/README.md).

## Key reports

- [4.2 Runtime Core](4.2_RUNTIME_CORE.md)
- [4.3 Graphics Engine](4.3_GRAPHICS_ENGINE.md)
- [4.4 Interaction Engine](4.4_INTERACTION_ENGINE.md)
- [4.5 Home Assistant Engine](4.5_HOME_ASSISTANT_ENGINE.md)
- [4.7.1 Prototype Command Bridge](4.7.1_PROTOTYPE_COMMAND_BRIDGE.md)
- [4.7.2.1 Runtime Device Store](4.7.2.1_RUNTIME_DEVICE_STORE.md)
- [4.7.2.2 Home Assistant State Adapter](4.7.2.2_HOME_ASSISTANT_STATE_ADAPTER.md)
- [4.7.2.3 Selected-Device Model Binding](4.7.2.3_SELECTED_DEVICE_MODEL_BINDING.md)
- [4.7.3 Colour Sphere and Brightness Gestures](4.7.3_COLOUR_SPHERE_AND_BRIGHTNESS_GESTURES.md)
- [4.7.4 Prototype Validation and Device Testing](4.7.4_PROTOTYPE_VALIDATION_AND_DEVICE_TESTING.md)
- [4.8.1 Performance Observability](4.8.1_PERFORMANCE_OBSERVABILITY.md)
- [4.8.2 Performance Pressure Integration](4.8.2_PERFORMANCE_PRESSURE_INTEGRATION.md)
- [4.8.3 Asset Cache and Sustained Profiling](4.8.3_ASSET_CACHE_AND_SUSTAINED_PROFILING.md)

## Supporting validation still required

Before beta acceptance, record sustained runs on:

- iPad Safari landscape;
- iPad Safari portrait;
- desktop Safari or Chrome;
- a lower-power mobile or tablet device.

This validation supports Phase 5 but does not block beginning the visible product implementation.

## Required validation command

```bash
pnpm check
```

This runs formatting, linting, type checking, tests and builds across the workspace.

## Development rule

Implementation must follow the approved Phase 2 architecture, Phase 3 UX contracts and Phase 3.5 engineering specifications. From Phase 5 onward, a milestone is not complete unless it also produces a runnable, visually reviewable build.
