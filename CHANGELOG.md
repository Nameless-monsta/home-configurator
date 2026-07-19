# Changelog

All notable changes to Home Configurator will be documented here.

## Unreleased

### Added

- Spatial routing: stable deep links and browser back/forward for the persistent shell (`#/`, `#/room/{id}`, `#/alarm`, `#/settings`, `#/device/{id}`) with pending-route resolution against live Home Assistant data
- Hero travel choreography: device switches physically depart/arrive along the direction of travel instead of hard remounts (reduced-motion safe)
- Pointer examination: the hero leans subtly toward the pointer while browsing on hover-capable devices (interruptible springs)
- Detail information sequencing: close, identity, readout and control tray reveal in order after the camera settles; unified fast fade on close
- Room spatial identity: stable per-room ambient accent re-lights the persistent scene on room entry
- Mobile bottom navigation: thumb-zone primary navigation on portrait phones with safe-area support, upward menu, and detail mode clearing the thumb zone for the control tray; landscape-phone fallback sizing

### Changed

- three.js split into its own long-cached build chunk (app chunk 733KB → 208KB)

### Removed

- Carousel-era orphans no longer reachable from the application: `favourite-carousel`, `hero-preview`, `prototype-home-v1.css`

### Previously added

- Project vision, roadmap and documentation structure
- Phase 1 iyO research and interaction specification
- Phase 2 product architecture and ADR system
- Phase 3 UX specifications and validation
- Phase 3.5 engineering contracts and implementation gate
- TypeScript monorepo, package boundaries and GitHub Actions CI
- Runtime Core with lifecycle, services, events, scheduling, diagnostics, plugins and asset management
- Graphics Engine with persistent Three.js rendering, camera framing, scene graph, lighting, quality tiers, post-processing, GLTF assets, HDR environments, LOD, context recovery and GPU-resource disposal
- Runnable responsive dashboard milestone stage
- Phase 5 IYO experience shell: hero carousel, device detail, adaptive tray, living objects
- Cross-device navigation rail with editorial index counter, in-detail device switching and arrow-key travel
- Full design recovery: persistent global navigation, single persistent hero stage with camera choreography and device-aware atmosphere, slide-up Home content, Room and Alarm sections, search, and a model registry with GLB/GLTF overrides and a Settings configuration flow

### In progress

- Interaction Engine
- Home Assistant Engine
- UI Engine
- First interactive Home Assistant prototype

### Pending decision

- Public project license
