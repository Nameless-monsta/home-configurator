# Claude Handoff — Phase 5.1 to 5.6

## Read first

Before changing code, read:

1. `docs/PHASE-5-IYO-EXPERIENCE.md`
2. Existing Phase 5 source files in `apps/dashboard/src/phase5/`
3. Existing graphics, runtime, interaction and Home Assistant package contracts

## Required working method

- Inspect the repository before editing.
- Preserve existing state adapters and command paths.
- Do not replace procedural heroes with static images or SVGs.
- Do not create a second application state store.
- Work from Phase 5.1 through Phase 5.6 in order.
- Keep progress output to concise headlines only.
- Spend tokens on code and verification, not narration.
- Build, typecheck and test after each milestone where practical.
- Commit complete files, not partial snippets.

## Product target

Recreate the interaction philosophy and spatial browsing character of IYO.ai as faithfully as practical while retaining the controls required for a real Home Assistant frontend.

This means:

- horizontally browsable 3D products/devices
- strong object presence
- restrained typography and chrome
- direct manipulation
- continuous spatial transitions
- contextual controls rather than permanent button walls
- tactile motion and living idle states

It does not mean copying trademarks, assets or proprietary source code.

## Implementation order

### 5.1

Integrate `FavouriteHeroCarousel` into Home. Replace the favourite device card grid. The carousel must create actual hero objects via the existing hero factory, expose active-index changes and call Device Detail on selection.

### 5.2

Use the same carousel/shelf primitive in Rooms. Group by category and render horizontal 3D shelves. Apply sensible performance limits and lazy mounting.

### 5.3

Refactor Device Detail into:

- hero stage
- identity and primary readout
- adaptive control tray
- direct interaction controller
- accessible fallback controls

Do not remove required controls; place secondary controls in the adaptive tray.

### 5.4

Adopt the shared motion tokens and spring implementation. Device opening and closing must read as one reversible spatial journey.

### 5.5

Register category-specific living behaviours through the living-object system. Keep all animation reduced-motion aware and dispose every registration.

### 5.6

Complete typography, spacing, materials, responsive behaviour, accessibility and performance checks. Add or update tests for the new experience.

## Definition of done

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- relevant tests
- `pnpm build`
- no duplicate listeners or undisposed Three.js resources
- no direct Home Assistant writes outside existing command adapters
- mobile touch interaction verified
- keyboard navigation verified
- reduced-motion verified

## Forbidden shortcuts

- Replacing 3D favourites with icons
- Keeping the old favourite grid as the primary Home experience
- Rendering all heroes in one WebGL canvas without lifecycle limits
- Adding more permanent buttons to solve interaction problems
- Using long generic fade transitions instead of spatial movement
- Hiding accessibility controls completely
