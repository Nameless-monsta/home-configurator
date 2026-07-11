# iyO Interaction Specification

## Purpose

Document the observable interaction language used as the primary reference for Home Configurator. The goal is not to copy proprietary code or assets, but to understand the composition, navigation, motion, hierarchy and 3D staging that make the experience coherent.

## Confirmed design traits

- One dark, near-monochrome environment centered on `#101010`.
- One hero object dominates the screen.
- Navigation, menus and configurator controls remain visually subordinate.
- Product switching occurs inside one persistent shell.
- Menu, cart, configuration and product states are coordinated rather than independent pages.
- Typography is integrated with the 3D composition.
- Device-generated color is meaningful; permanent interface chrome remains neutral.

## Screen/state inventory

- Landing / global shell
- Adaptive menu closed
- Adaptive menu open
- Product hero
- Product story / overview
- Product anatomy / exploded view
- Color or variant selector
- Technical specification
- FAQ / supporting information
- Cross-product navigation
- Loading, unavailable and error states
- Orientation gate on constrained mobile layouts

## Navigation state model

```text
Route state
× shell state
× overlay state
× product state
× responsive profile
```

The stage is never destroyed when navigation opens. Closing an overlay must restore the exact previous state. Device/product switching must not resemble a page refresh.

## Motion language

Home Configurator adopts a shared physics-based motion system:

- spring-driven camera and UI movement;
- controlled inertia for object manipulation;
- coordinated object, camera and typography transitions;
- ambient motion that stops during direct manipulation;
- reduced-motion alternatives;
- semantic motion families rather than per-component arbitrary animations.

## Responsive behavior

- iPad landscape is the canonical deployment.
- iPhone landscape preserves the full configurator with reduced concurrent information.
- iPhone portrait is a compact fallback or orientation-gate state.
- Desktop increases negative space and peripheral information without changing the core hierarchy.

## Translation to Home Assistant

| Reference concept | Home Configurator concept |
|---|---|
| Product family | Room, floor or system |
| Product | Visual device |
| Variant | Entity mode, source, scene or color |
| Configurator control | Capability-driven control |
| Product anatomy | Supporting entities and capabilities |
| Product switch | Room/device transition |
| Transaction status | Pending action, active state or recent change |

## Non-negotiable constraints

- No conventional dashboard card grid.
- No decorative network lines or generic science-fiction HUD.
- No permanent green accent.
- No 3D floor plan as the primary interaction.
- The selected device remains the visual center of attention.
- Every state must feel like part of one continuous environment.
