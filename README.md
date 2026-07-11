# Home Configurator

A next-generation 3D spatial interface framework for Home Assistant.

Home Configurator replaces conventional card-based dashboards with a persistent cinematic interface built around rooms, devices, capabilities, and interactive 3D models.

## Current status

- Phase 1 — iyO research and interaction specification: complete
- Phase 2 — product architecture: complete
- Phase 3 — UX and visual design: next
- Phase 4 — development and HACS release: planned

See [STATUS.md](STATUS.md) and [ROADMAP.md](ROADMAP.md).

## Core principles

- Capability-driven rather than entity-ID-driven
- Automatic room and device discovery
- One persistent 3D stage
- Frontend-only operation with an optional Home Assistant integration
- Portable preset/blueprint configuration
- Original code and assets
- Local-first and offline-capable

## Documentation

Start with [docs/INDEX.md](docs/INDEX.md).

## Planned repository layout

```text
docs/                  Research, architecture, UX, ADRs and diagrams
packages/              Frontend, renderer, editor and shared packages
custom_components/     Home Assistant integration
examples/              Example presets and demo installations
tests/                 Shared tests and fixtures
.github/                Issue templates and workflows
```

## License

No open-source license has been selected yet. The repository remains private while the product architecture and implementation are developed.
