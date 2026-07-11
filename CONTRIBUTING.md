# Contributing

Home Configurator is currently in private architecture and design development.

## Working rules

- Keep Home Assistant-specific logic inside adapters and translation packages.
- UI and renderer code must consume normalized devices and semantic commands.
- New architecture decisions require an ADR.
- New user-facing behavior requires documentation and accessibility coverage.
- Never commit secrets, tokens, signed URLs or private installation data.
- 3D assets must include license and attribution metadata.

## Documentation

Architecture documents live under `docs/02-architecture/`. UX specifications live under `docs/03-ux/`. Implementation notes live under `docs/04-development/`.

## Commit style

Use clear conventional prefixes where practical:

```text
feat:
fix:
docs:
refactor:
test:
chore:
```

## Pull requests

A pull request should include:

- purpose and scope;
- linked issue or roadmap item;
- testing performed;
- screenshots/video for visual changes;
- documentation and ADR updates where needed.
