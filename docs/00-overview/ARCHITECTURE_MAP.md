# Architecture Map

```text
Home Assistant registries and states
        ↓
Discovery and entity abstraction
        ↓
Capability resolver
        ↓
Canonical device graph
        ↓
Application state + semantic command bus
        ↓
Interaction and transition engines
        ↓
Persistent UI shell + Three.js renderer
```

## Runtime surfaces

- **Custom view:** canonical full-screen runtime.
- **Custom card:** launcher, embedded preview and simple configuration entry point.
- **Visual editor:** complete room, device, model and preset configuration.
- **Optional integration:** persistent storage, optimized discovery, model metadata and WebSocket APIs.

## Major boundaries

- The renderer never reads raw Home Assistant entities.
- UI controls emit semantic commands rather than service calls.
- Entity IDs are configuration references, never hardcoded behavior.
- The optional integration enriches the product but is not required for runtime.
- Models, camera presets, materials and exploded-view metadata are resolved through a registry.

## Core packages

```text
app-shell
ha-adapter
config-kernel
state
navigation
routing
capability-engine
service-adapter
command-bus
interaction-engine
motion-engine
renderer-three
model-registry
design-system
editor
custom-view
custom-card
shared-types
```
