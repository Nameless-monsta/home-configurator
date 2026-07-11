# Phase 4 — Development

**Status:** In progress  
**Entry gate:** Phase 3.5 approved

## Workstream

- [x] **4.1 Repository, build and CI setup**
- [x] **4.2 Runtime Core**
- [ ] **4.3 Graphics Engine**
- [ ] **4.4 Interaction Engine**
- [ ] **4.5 Home Assistant Engine**
- [ ] **4.6 UI Engine**
- [ ] **4.7 First Interactive Prototype**
- [ ] **4.8 Performance optimisation**
- [ ] **4.9 Documentation**
- [ ] **4.10 HACS release**

## Completed milestones

### 4.1 — Repository, build and CI setup

The repository uses Node.js 22, pnpm workspaces, Turbo, strict TypeScript, ESLint, Prettier, Vitest and GitHub Actions validation.

### 4.2 — Runtime Core

The implemented runtime now provides:

- deterministic bootstrap and shutdown;
- typed dependency injection and service registration;
- typed event delivery;
- centralized frame scheduling;
- runtime diagnostics;
- configuration loading;
- plugin and asset lifecycles;
- a Home Assistant adapter boundary with a mock implementation;
- a runnable Vite dashboard shell.

See [4.2 Runtime Core](4.2_RUNTIME_CORE.md).

## Required validation command

```bash
pnpm check
```

This runs formatting, linting, type checking, tests and builds across the workspace.

## Development rule

Implementation must follow the approved Phase 2 architecture, Phase 3 UX contracts and Phase 3.5 engineering specifications. Any change to runtime ownership or public contracts requires an ADR and an update to the corresponding specification.
