# Phase 5 — IYO Experience Layer

## Product definition

Home Configurator is not a conventional Home Assistant dashboard. It is a spatial interaction system inspired by IYO.ai in which the device itself is the interface.

The existing runtime, Home Assistant adapters, state model, graphics engine and procedural device heroes remain the engineering foundation. Phase 5 replaces the visible dashboard experience with a continuous, object-first browsing and control experience.

## Non-negotiable principles

1. The object is the interface.
2. A screen exposes one primary action at a time.
3. Motion explains hierarchy and navigation; objects travel instead of disappearing.
4. Whitespace is functional.
5. Objects have weight, inertia and idle life.
6. Do not use dashboard grids where a spatial carousel or gallery works.
7. Controls remain accessible, but secondary controls are contextual and collapsible.
8. Reduced-motion mode preserves hierarchy without decorative movement.

## Scope

### 5.1 Home Experience

- Replace favourite-device cards with a horizontally scrollable 3D hero carousel.
- Use touch momentum, CSS scroll snapping and a centred active item.
- Render real procedural heroes, not category icons.
- Selecting an item transitions the same object into Device Detail.
- Keep a restrained ambient status line for temperature, humidity, air and security.
- Keep rooms and scenes below the carousel in editorial, low-density sections.

### 5.2 Rooms Experience

- Rooms open as galleries, not folder grids.
- Device categories are horizontal shelves.
- Every shelf item uses a 3D hero preview where performance permits.
- Selecting a device preserves spatial continuity into Device Detail.
- Category order follows actual relevance: lighting, climate, covers, media, security, appliances, sensors.

### 5.3 Device Experience

- Hero object dominates the viewport.
- Show device name, room and one primary value.
- Direct manipulation is primary: sphere, ring, vertical drag, tap or hold.
- Secondary controls live in an adaptive control tray.
- Tray opens on explicit request or brief interaction, then settles to a compact state.
- Accessible buttons remain available for every gesture.

### 5.4 Motion System

- Use a shared spring model for camera, carousel focus, control trays and hero transitions.
- Navigation uses travel, scale and depth. Avoid arbitrary crossfades.
- Opening a device: selected preview advances, siblings recede, camera frames hero, controls enter last.
- Closing reverses the path.
- Motion tokens are centralised and reduced-motion aware.

### 5.5 Living Objects

- Each hero has category-specific idle and response behaviour.
- Lamp: breathing glow and immediate filament response.
- Curtain/blind: delayed fabric/slat follow and restrained overshoot.
- Thermostat: magnetic detents and eased needle.
- Vacuum: lidar rotation, wheel motion and dock pulse.
- Camera: subtle lens attention and mechanical privacy response.
- Colour sphere: breathing, shimmer, pointer attraction and energy response.
- All behaviours must remain deterministic enough for tests and low-power mode.

### 5.6 Final Polish

- Editorial typography and generous spacing.
- Consistent neutral materials, warm highlights and controlled bloom.
- Mobile-first touch targets and safe-area support.
- Keyboard, screen-reader and reduced-motion parity.
- Performance budgets and diagnostics.
- No visual regression back to card-heavy dashboard layouts.

## Acceptance criteria

- Home favourites can be browsed horizontally by touch and mouse.
- Each favourite visibly uses a 3D model.
- Device selection enters a dedicated object-first control page.
- Every device has one obvious primary control and accessible fallbacks.
- Rooms use horizontal category shelves.
- Motion is spatially continuous and reversible.
- Reduced-motion mode remains fully usable.
- No phase introduces duplicated state outside the existing Home Assistant/runtime state path.
- Documentation and implementation stay together in the repository.
