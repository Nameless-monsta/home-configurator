# Phase 3.5 — Engineering Specifications

**Status:** Complete and approved  
**Purpose:** Convert approved product architecture and UX into implementation-ready runtime contracts before production development begins.

## Why this phase exists

Phase 1 established the interaction reference. Phase 2 defined the product architecture. Phase 3 approved the UX. Phase 3.5 freezes the engineering rules that code must implement.

Development must not invent new runtime ownership, timing, gesture, rendering, asset, plugin, or Home Assistant reconciliation behavior without updating these specifications.

## Workstream

- [x] **3.5.1 Runtime execution model**
- [x] **3.5.2 Camera engine contract**
- [x] **3.5.3 Renderer and frame pipeline**
- [x] **3.5.4 Input and gesture arbitration**
- [x] **3.5.5 Home Assistant runtime contract**
- [x] **3.5.6 Performance and resource budgets**
- [x] **3.5.7 3D asset pipeline and validation**
- [x] **3.5.8 Plugin and extension API**
- [x] **3.5.9 Blueprint/runtime schema reference**
- [x] **3.5.10 Engineering validation and implementation gate**

## Completed documents

- [3.5.1 Runtime Execution Model](3.5.1_RUNTIME_EXECUTION_MODEL.md)
- [3.5.2 Camera Engine Contract](3.5.2_CAMERA_ENGINE_CONTRACT.md)
- [3.5.3 Renderer and Frame Pipeline](3.5.3_RENDERER_AND_FRAME_PIPELINE.md)
- [3.5.4 Input and Gesture Arbitration](3.5.4_INPUT_AND_GESTURE_ARBITRATION.md)
- [3.5.5 Home Assistant Runtime Contract](3.5.5_HOME_ASSISTANT_RUNTIME_CONTRACT.md)
- [3.5.6 Performance and Resource Budgets](3.5.6_PERFORMANCE_AND_RESOURCE_BUDGETS.md)
- [3.5.7 3D Asset Pipeline and Validation](3.5.7_3D_ASSET_PIPELINE_AND_VALIDATION.md)
- [3.5.8 Plugin and Extension API](3.5.8_PLUGIN_AND_EXTENSION_API.md)
- [3.5.9 Blueprint and Runtime Schema Reference](3.5.9_BLUEPRINT_RUNTIME_SCHEMA_REFERENCE.md)
- [3.5.10 Engineering Validation and Implementation Gate](3.5.10_ENGINEERING_VALIDATION_AND_IMPLEMENTATION_GATE.md)

## Required outputs

Every specification defines:

- ownership boundaries;
- lifecycle and state machine;
- public interfaces;
- event and command flow;
- failure behavior;
- responsive and accessibility implications;
- performance constraints;
- diagnostics;
- deterministic acceptance criteria.

## Execution order

```text
Runtime execution model
→ Camera engine
→ Renderer pipeline
→ Input arbitration
→ Home Assistant runtime
→ Performance budgets
→ Asset pipeline
→ Plugin API
→ Blueprint/runtime schema
→ Final engineering validation
```

## Phase exit gate

All conditions are satisfied:

1. all runtime owners are explicit;
2. frame, command, transition, and reconciliation ordering is deterministic;
3. input conflicts use one arbitration model;
4. render and performance budgets are measurable;
5. asset and plugin contracts are versioned;
6. Home Assistant disconnect, retry, stale state, and command failure behavior are defined;
7. a contributor can implement the first vertical slice without inventing architecture.

**Gate result:** Phase 4 implementation approved.
