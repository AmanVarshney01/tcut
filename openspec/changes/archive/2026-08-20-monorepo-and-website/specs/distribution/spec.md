## ADDED Requirements

### Requirement: Monorepo layout
The repository SHALL be a Bun workspace (`apps/*`, `packages/*`) with Turborepo tasks `build`, `test`, `typecheck`. The npm package SHALL live in `packages/tcut` with its own `package.json`, README, tests and examples; `bun publish` SHALL run from that directory. CI SHALL install once at the root and run the package's typecheck/tests and the site build; the release workflow SHALL build binaries from `packages/tcut`.

#### Scenario: root commands
- **WHEN** `bun install && bun run typecheck && bun run test && bun run build` run at the root
- **THEN** the tcut package and the website are both checked and built

#### Scenario: release from monorepo
- **WHEN** a `v*` tag is pushed
- **THEN** binaries are built from `packages/tcut` and attached to the release, and npm publish (when tokened) runs in `packages/tcut`
