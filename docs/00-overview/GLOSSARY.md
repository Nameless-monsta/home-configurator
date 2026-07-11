# Glossary

**Capability** — A normalized function such as power, brightness, media volume or target temperature.

**Device profile** — A reusable description of a visual device category, including preferred capabilities, controls and presentation.

**Entity binding** — A semantic link between a Home Assistant entity and a device role such as `power`, `battery` or `primary`.

**HCML** — Home Configurator Motion Language, the shared physics and animation system.

**HCDS** — Home Configurator Design System, the shared visual tokens, materials and composition rules.

**Model registry** — The catalog that resolves device profiles and manufacturer/model aliases to 3D assets and metadata.

**Normalized device state** — Renderer-safe state generated from raw Home Assistant states and attributes.

**Preset / blueprint** — A portable, versioned configuration that describes intent and mapping requirements rather than fixed entity IDs.

**Resolved device** — The runtime representation of one visual device after discovery, configuration, capability detection and presentation resolution.

**Semantic command** — A renderer-independent action such as `power.set` or `light.brightness.set`.

**Synthetic device** — A stable visual-device group created for entities that do not share a Home Assistant device registry entry.

**Visual device** — The object presented to the user. It may map to one entity, one HA device, or several related entities and devices.
