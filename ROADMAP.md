# Roadmap

## Delivery principle from Phase 5 onward

Every milestone must produce a runnable, visually reviewable build. A milestone is not complete if the product owner cannot open the application, see the change, interact with it and evaluate whether the experience matches the approved direction.

Design specification, engineering infrastructure and visual implementation are tracked separately. A design being approved does not mean it has been faithfully implemented in the product.

## Phase 0 — Project foundation

- [x] Repository created
- [x] Documentation structure established
- [x] Project status and architecture indexes added
- [x] Package skeletons created
- [x] CI and linting configured
- [ ] License selected

## Phase 1 — iyO research and interaction specification

- [x] Technology stack identification
- [x] Screen and state audit
- [x] Navigation state machine
- [x] Motion language
- [x] Typography and spacing
- [x] Responsive behaviour
- [x] Camera and lighting
- [x] UI component inventory
- [x] Home Assistant translation matrix
- [x] Home Configurator Design System
- [x] Final approval

## Phase 2 — Product architecture

- [x] Overall software architecture
- [x] Frontend architecture
- [x] Backend and integration architecture
- [x] Data model
- [x] Entity abstraction and automatic discovery
- [x] Device capability mapping
- [x] Model registry
- [x] Preset and blueprint format
- [x] HACS packaging strategy
- [x] Final architecture approval

## Phase 3 — UX and visual design specification

**Status:** Approved specification. Faithful product implementation continues in Phase 5.

- [x] Navigation shell specification
- [x] Room navigation specification
- [x] Device configurator specification
- [x] Colour sphere specification
- [x] Climate interaction specification
- [x] Media interaction specification
- [x] Vacuum interaction specification
- [x] Scene interaction specification
- [x] Transition library specification
- [x] Animation library specification
- [x] Final UX approval

## Phase 3.5 — Engineering specifications

- [x] Runtime execution model
- [x] Camera engine contract
- [x] Renderer and frame pipeline
- [x] Input and gesture arbitration
- [x] Home Assistant runtime contract
- [x] Performance and resource budgets
- [x] 3D asset pipeline and validation
- [x] Plugin and extension API
- [x] Blueprint and runtime schema reference
- [x] Final engineering validation and implementation gate

## Phase 4 — Engine, runtime and technical prototype

**Status:** Engineering implementation substantially complete. Physical sustained-device profiling remains a supporting validation task.

- [x] Repository, build and CI setup
- [x] Runtime Core
- [x] Graphics Engine
- [x] Interaction Engine
- [x] Home Assistant Engine
- [x] UI Engine foundation
- [x] First Interactive Prototype
  - [x] Prototype Command Bridge
  - [x] Authoritative State and Model Binding
    - [x] Runtime Device Store
    - [x] Home Assistant State Adapter
    - [x] Selected-Device Model Binding
  - [x] Colour and brightness gesture plumbing
  - [x] Prototype validation contracts
- [x] Performance implementation
  - [x] Adaptive quality tiers
  - [x] Renderer and long-task observability
  - [x] Resource-pressure response
  - [x] Bounded asset cache
- [ ] Sustained profiling on target iPad and desktop hardware

## Phase 5 — Product Experience

**Status:** Active

- [ ] **5.1 Application Shell** — Active
  - [ ] Runnable local development command with clear launch instructions
  - [ ] Visually faithful iyO-inspired spatial canvas
  - [ ] Minimal floating room and device navigation
  - [ ] Contextual controls instead of permanent dashboard panels
  - [ ] One polished Living Room to IKEA lamp journey
  - [ ] Shareable review build or preview URL
- [ ] **5.2 Visual Design Language**
  - [ ] Production typography hierarchy
  - [ ] Glass, blur, depth, shadow and elevation system
  - [ ] Colour, spacing and icon implementation
  - [ ] Motion tokens and reduced-motion equivalents
- [ ] **5.3 Hero Device Experience**
  - [ ] Production-quality lamp asset and materials
  - [ ] Selection, focus, power, brightness and availability states
  - [ ] Premium lighting, bloom, shadow and ambient response
- [ ] **5.4 Spatial Colour Sphere**
  - [ ] True floating sphere control
  - [ ] Hue and saturation surface interaction
  - [ ] Inertia, depth, reflection and selection feedback
  - [ ] Gesture-first brightness behaviour
- [ ] **5.5 Room Experience**
  - [ ] Cinematic room transitions
  - [ ] Spatial camera choreography
  - [ ] Room ambience and environmental lighting
  - [ ] Multi-device composition
- [ ] **5.6 AI Experience**
  - [ ] Contextual assistant surface
  - [ ] Natural-language device and room control
  - [ ] Automation suggestions and explanation

## Supporting engineering track

These tasks support Product Experience but do not replace visible product milestones:

- [ ] Complete physical sustained-device profiling
- [ ] Select project licence
- [ ] Complete documentation for public contributors
- [ ] HACS packaging and release preparation
- [ ] Security, privacy and production-readiness review

## Phase 6 — Production readiness

- [ ] Authentication and secrets handling
- [ ] Deployment and preview environments
- [ ] Error recovery and telemetry policy
- [ ] Security and privacy validation
- [ ] Installation and upgrade workflow

## Phase 7 — Beta

- [ ] Limited real-home testing
- [ ] Cross-device QA
- [ ] Accessibility review
- [ ] Performance acceptance on target hardware
- [ ] User feedback and iteration

## Phase 8 — Release

- [ ] Release candidate
- [ ] HACS publication
- [ ] Public documentation
- [ ] Stable release
