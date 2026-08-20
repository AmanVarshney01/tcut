## ADDED Requirements

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
