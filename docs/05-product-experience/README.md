# Phase 5 — Product Experience

**Status:** Active  
**Active milestone:** 5.1 Application Shell

## Purpose

Phase 5 turns the approved UX direction and completed engineering foundation into the visible product.

The goal is not another throwaway prototype. The goal is a production-bound vertical slice that can be launched, reviewed and improved continuously.

## Delivery rule

Every Phase 5 milestone must produce a runnable, visually reviewable build. A milestone is incomplete if the product owner cannot:

1. open the application;
2. see the new experience;
3. interact with it;
4. compare it with the approved design direction;
5. provide concrete visual and interaction feedback.

Screenshots, recordings or a preview URL must accompany milestone completion.

## Product direction

The product should feel spatial, calm and object-first rather than like a conventional smart-home dashboard.

Core principles:

- the selected room and device are the centre of the experience;
- controls appear contextually and disappear when they are not needed;
- glass, blur, light and depth support the scene rather than dominate it;
- camera movement and transitions communicate navigation;
- the interface remains useful with reduced motion and keyboard input;
- diagnostics are available but visually secondary;
- Home Assistant remains authoritative while Runtime provides immediate feedback.

## Workstream

- [ ] **5.1 Application Shell** — Active
- [ ] **5.2 Visual Design Language**
- [ ] **5.3 Hero Device Experience**
- [ ] **5.4 Spatial Colour Sphere**
- [ ] **5.5 Room Experience**
- [ ] **5.6 AI Experience**

## 5.1 — Application Shell

Create the real product frame and one complete reviewable journey.

Primary journey:

```text
Launch application
→ enter Living Room
→ see spatial scene
→ select IKEA TRÅDFRI lamp
→ reveal contextual controls
→ change colour and brightness
→ send command through Runtime and Home Assistant
→ see confirmation or rollback
```

See [5.1 Application Shell](5.1_APPLICATION_SHELL.md).

## 5.2 — Visual Design Language

Implement the approved visual direction as production tokens and components:

- typography hierarchy;
- spacing and composition;
- glass and blur;
- shadow, depth and elevation;
- colour and iconography;
- motion and reduced-motion equivalents.

## 5.3 — Hero Device Experience

Make one lamp feel complete:

- production-quality asset and materials;
- power, brightness, colour and availability states;
- selection and focus behaviour;
- lighting, bloom, shadow and ambient response;
- pending, confirmed and rollback feedback.

## 5.4 — Spatial Colour Sphere

Implement the signature colour interaction:

- a true floating sphere rather than a flat colour pad;
- hue and saturation mapped to surface movement;
- physical depth, reflection and selection feedback;
- inertia where appropriate;
- gesture-first brightness behaviour;
- accessible keyboard alternative.

## 5.5 — Room Experience

Expand from one device to a coherent spatial room:

- cinematic camera choreography;
- room transitions;
- environmental lighting and ambience;
- multi-device composition;
- contextual navigation.

## 5.6 — AI Experience

Add AI only after the visual and interaction language is stable:

- contextual assistant surface;
- natural-language room and device control;
- automation suggestions;
- clear explanation of proposed actions;
- confirmation before consequential changes.

## Supporting engineering

Phase 4 infrastructure remains active as a supporting track when required, including:

- sustained performance profiling;
- asset optimisation;
- deployment and preview automation;
- security and privacy work;
- HACS packaging.

Supporting engineering must not replace visible Product Experience delivery.
