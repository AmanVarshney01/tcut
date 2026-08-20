# distribution Specification

## Purpose
TBD - created by archiving change tcut-m4-distribution. Update Purpose after archive.
## Requirements
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

### Requirement: npm package contents
The published npm package SHALL contain only `src/`, `scripts/`, `README.md` and `LICENSE`, SHALL declare `engines.bun >= 1.4.0`, and SHALL expose the `tcut` bin and the `"tcut"` module entry. Installing it with `bun add -g tcut` SHALL make `tcut` runnable without a build step (renderer assets are built at runtime when the prebuilt ones are absent).

#### Scenario: dry run
- **WHEN** `bun publish --dry-run` is executed
- **THEN** the file list contains no `out/`, `dist/`, `node_modules/` or `generated/` entries

### Requirement: Tagged releases
Pushing a `v<version>` tag SHALL run a workflow that fails if the tag does not match `package.json`, builds binaries for darwin-arm64, darwin-x64, linux-x64, linux-arm64 and windows-x64 with SHA-256 checksums, and publishes a GitHub Release with generated notes. npm publishing SHALL run only when an `NPM_TOKEN` secret is present.

#### Scenario: release v0.1.0
- **WHEN** tag `v0.1.0` is pushed and `package.json` is at 0.1.0
- **THEN** a release named "tcut v0.1.0" exists with five binaries and `SHA256SUMS`

#### Scenario: mismatched tag
- **WHEN** the tag does not equal `v` + package version
- **THEN** the workflow fails before building

### Requirement: Documented system requirements
The README SHALL state, per feature (record / svg+html / stills+frames / mp4+gif+webm / webp), what the user's system needs, including the Bun version, WebView backend per OS, ffmpeg and libwebp, and fonts.

#### Scenario: reader on Linux
- **WHEN** a Linux user reads the Requirements section
- **THEN** they learn that pixel rendering needs Chrome/Chromium/Edge/Brave and that SVG/HTML need nothing extra

