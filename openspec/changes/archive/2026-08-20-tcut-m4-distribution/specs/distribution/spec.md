## ADDED Requirements

### Requirement: Single-file binary
`bun run build` SHALL produce `dist/tcut` via `bun build --compile` that renders a cast without access to `node_modules` or the source tree. Renderer and player bundles, the Ghostty WASM and wterm CSS SHALL be embedded.

#### Scenario: binary renders
- **WHEN** `dist/tcut render demo.cast -o out.mp4` runs from an empty directory
- **THEN** `out.mp4` is produced

### Requirement: Asset fallback in development
When prebuilt assets are absent, the renderer SHALL build them at runtime with `Bun.build` so `bun src/cli.ts` works right after `bun install`.

#### Scenario: fresh clone
- **WHEN** `bun install && bun src/cli.ts examples/demo.ts` runs without `generated/`
- **THEN** the demo renders

### Requirement: Init templates
`tcut init [name] --template basic|tour|test` SHALL scaffold the chosen template; default `basic`.

#### Scenario: tour template
- **WHEN** `tcut init demo --template tour` runs
- **THEN** `demo.video.ts` contains hide/run/expect/screenshot usage and records successfully

### Requirement: Continuous integration
A GitHub Actions workflow on `macos-latest` SHALL run typecheck, `bun test`, render `examples/demo.ts`, and build the binary on every push and pull request.

#### Scenario: CI green
- **WHEN** the workflow runs on a push
- **THEN** all steps succeed and the demo outputs are uploaded as artifacts
