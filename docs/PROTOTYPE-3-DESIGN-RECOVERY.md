# Prototype 3 — Full Design Recovery

Implements the HOME_CONFIGURATOR_DESIGN_RECOVERY brief on top of the existing
runtime, Home Assistant command path, device store and graphics engine.

## One persistent spatial stage

The multi-canvas favourite carousel is retired from the shell. A single
`HeroStage` mounts one hero object on the shared `GraphicsEngine` scene for
browse *and* detail:

- switching devices swaps the object in place (rail, swipe, arrow keys,
  favourites, tiles, search);
- opening Device Detail reframes the camera around the same object — nothing
  is duplicated, destroyed or crossfaded;
- closing detail reverses the framing and restores browse.

Camera choreography uses the engine `CameraRig` framing presets (browse
2.35× padding / 950 ms, detail 1.95× / 800 ms, reduced-motion aware).

## Persistent global navigation

`NavigationBar` stays fixed across Home, Rooms, Alarm, Settings and Device
Detail: Home, a Rooms selector (one item, not the whole navigation), Alarm,
Settings and Search, with `aria-current` active states.

## Home structure

First viewport: editorial hero (room · category eyebrow, display name, live
status, Open action, index in the rail) over the stage with a device-aware
atmospheric layer (`--p5-ambient` glow, floor falloff, vignette). Scrolling
slides the content sheet over the stage: favourites, live "At a glance"
summary tiles (lights, climate, security, covers, media, cleaning), rooms and
the full device inventory. Tiles and favourites patch live values in place.

## Rooms and Alarm

Rooms are full sections: identity header with environment line
(temperature/humidity/security), quick all-lights on/off (dispatched per
device through the existing command path), summary tiles and the room's
device list. Alarm is a security-filtered section with a secured/attention
headline.

## Device Detail

`DeviceDetail` no longer creates a hero. It attaches the colour sphere,
thermostat ring, drag/hold gestures, adaptive control tray, identity and
readout around the stage's existing object; every control from the previous
prototype is preserved and all writes still flow through
`HomeAssistantStateAdapter.dispatch`.

## Model fidelity

`HeroModelRegistry` implements the 2.7 registry priority (user override →
manufacturer/model alias → procedural fallback). Settings provides the
configuration flow: select device → source (built-in / GLB URL) → scale,
rotation, height → save with live stage preview. GLB/GLTF loads through the
engine's cached `ModelAssetLoader`; failures keep the procedural hero.
Overrides persist in local storage and are presentation-only.

## Validation

`pnpm format:check`, `lint`, `typecheck`, all package test suites (31
dashboard assertions across 8 files) and the production build pass.
