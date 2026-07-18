# Phase 5 implementation status

Branch: `phase-5-iyo-experience`

## Added in this branch

- Complete Phase 5.1–5.6 product and UX contract.
- Claude implementation handoff and anti-drift rules.
- `FavouriteHeroCarousel` for horizontally browsable 3D favourite devices and room shelves.
- `AdaptiveControlTray` for compact primary readouts and contextual secondary controls.
- Shared spring values, motion tokens and spatial transition controller.
- Living-object behaviour registry with initial light, thermostat and vacuum behaviours.
- Responsive, touch-first carousel and adaptive-control styling.
- Public Phase 5 module exports.

## Integration still required against the active application shell

The repository `main` branch currently contains the earlier `UiFoundation`/`UiNavigation` dashboard application. The Phase 5 shell source supplied separately by the project owner is not present on `main`. Therefore this branch intentionally adds the new experience layer as isolated reusable modules rather than deleting or guessing at the production wiring.

The next integration pass must:

1. Commit or restore the supplied Phase 5 shell, device-detail, views, models, colour-sphere and thermostat source files.
2. Replace the Home favourite grid with `FavouriteHeroCarousel`.
3. Use the carousel primitive for room category shelves.
4. Mount `AdaptiveControlTray` in Device Detail and map each device category to primary and secondary controls.
5. Connect `SpatialTransitionController` to open/close navigation.
6. Register living behaviours when hero models mount and dispose them when heroes unmount.
7. Import `experience.css` from the Phase 5 application entry point.
8. Run formatting, lint, typecheck, tests and build.

## Why the integration is separated

This avoids overwriting the stable dashboard with source files that are not yet represented in the repository history. It also gives Claude a clear, bounded integration task instead of asking it to redesign the system again.
