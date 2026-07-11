# Phase 4 — Development

**Status:** In progress  
**Entry gate:** Phase 3.5 approved

## Workstream

- [x] **4.1 Repository, build and CI setup**
- [ ] **4.2 Vertical runtime skeleton**
- [ ] **4.3 Persistent Three.js stage**
- [ ] **4.4 Navigation and transition slice**
- [ ] **4.5 Light controller and color sphere**
- [ ] **4.6 Home Assistant live integration**
- [ ] **4.7 Responsive and accessibility validation**
- [ ] **4.8 Performance validation**
- [ ] **4.9 Documentation**
- [ ] **4.10 HACS release**

## 4.1 implementation baseline

The repository now uses:

- Node.js 22;
- pnpm workspaces;
- Turbo task orchestration;
- strict TypeScript;
- ESLint flat configuration;
- Prettier;
- Vitest;
- GitHub Actions validation;
- package-level build, lint, type-check and test contracts.

The initial `@home-configurator/shared` package is included as a working pipeline fixture and the first source of common runtime types.

## Required validation command

```bash
pnpm check
```

This runs formatting, linting, type checking, tests and builds across the workspace.

## Development rule

Implementation must follow the approved Phase 2 architecture, Phase 3 UX contracts and Phase 3.5 engineering specifications. Any change to runtime ownership or public contracts requires an ADR and an update to the corresponding specification.
