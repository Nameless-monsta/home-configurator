# Project Status

Updated: 2026-07-11

## Overall

- Phase 0 repository foundation substantially complete
- Phase 1 complete
- Phase 2 complete
- Phase 3 complete and approved
- Phase 3.5 complete and approved
- Phase 4 ready to start

## Current gate

The engineering specification set is complete and approved. Runtime ownership, camera behavior, renderer/frame ordering, input arbitration, Home Assistant reconciliation, performance budgets, asset validation, plugin boundaries and blueprint/runtime schemas are locked for implementation.

Phase 4 may begin with repository/build/CI setup and the first vertical interactive prototype.

## Completed

- Repository documentation and package scaffolding
- iyO interaction audit
- Navigation state machine
- Motion language
- Design system
- Responsive specification
- Camera and lighting specification
- Home Assistant translation matrix
- Overall, frontend and backend architecture
- Canonical data model
- Automatic discovery/entity abstraction
- Capability mapping
- Model registry architecture
- Preset/blueprint architecture
- HACS packaging strategy
- Phase 3 UX specifications and final validation
- 3.5.1 Runtime execution model
- 3.5.2 Camera engine contract
- 3.5.3 Renderer and frame pipeline
- 3.5.4 Input and gesture arbitration
- 3.5.5 Home Assistant runtime contract
- 3.5.6 Performance and resource budgets
- 3.5.7 3D asset pipeline and validation
- 3.5.8 Plugin and extension API
- 3.5.9 Blueprint/runtime schema reference
- 3.5.10 Engineering validation and implementation gate

## Phase 3.5 workstream

- [x] 3.5.1 Runtime execution model
- [x] 3.5.2 Camera engine contract
- [x] 3.5.3 Renderer and frame pipeline
- [x] 3.5.4 Input and gesture arbitration
- [x] 3.5.5 Home Assistant runtime contract
- [x] 3.5.6 Performance and resource budgets
- [x] 3.5.7 3D asset pipeline and validation
- [x] 3.5.8 Plugin and extension API
- [x] 3.5.9 Blueprint/runtime schema reference
- [x] 3.5.10 Engineering validation and implementation gate

## Phase 4 first vertical prototype

The first vertical prototype must validate:

1. persistent shell and WebGL stage;
2. room-to-device transition;
3. one real Home Assistant color-capable light;
4. color sphere manipulation and two-finger brightness gesture;
5. optimistic and confirmed state reconciliation;
6. reduced-motion behavior;
7. iPad performance and responsive layout;
8. VoiceOver and keyboard basics;
9. generic model fallback;
10. diagnostics for frame, gesture, transition and command state.

## Next

1. Select the project license before public distribution.
2. Complete Phase 4.1 — repository, build and CI setup.
3. Build the approved vertical interactive prototype before expanding device coverage.
4. Record any implementation-driven contract change through the relevant specification and an ADR.
