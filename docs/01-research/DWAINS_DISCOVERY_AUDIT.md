# Dwains Dashboard Discovery Audit

## Purpose

Document the useful automatic-discovery pattern observed in Dwains Dashboard Next and the improvements required for Home Configurator.

## Observed pattern

The dashboard strategy reads Home Assistant registries directly:

```text
config/area_registry/list
config/device_registry/list
config/entity_registry/list
config/floor_registry/list
```

It resolves an entity's room using:

```text
entity area
→ parent device area
→ unassigned
```

It also groups entities by Home Assistant device ID, filters hidden/configuration/diagnostic entities from the primary UI, and tracks newly discovered devices for admission.

## Adopted principles

- Registry-based discovery is the default.
- Entity area and parent-device area are both considered.
- Diagnostic and configuration entities remain discoverable but do not become primary controls.
- One physical device should usually become one visual device.
- Newly detected devices should be surfaced for review instead of silently cluttering the interface.

## Home Configurator improvements

Area resolution precedence:

```text
1. Explicit Home Configurator override
2. Entity registry area
3. Parent device registry area
4. Sibling-entity area
5. Configured relationship
6. Suggested area
7. Unassigned inbox
```

Additional improvements:

- Confidence score and explanation for every inference.
- Conservative synthetic grouping for entity-only integrations.
- Primary-entity selection based on usefulness and controllability.
- Profile and 3D-model recommendation.
- Reconciliation that preserves user order, names, models and room overrides.
- Missing devices remain recoverable rather than being deleted.
- Automatic generation produces the same canonical document as manual configuration.
