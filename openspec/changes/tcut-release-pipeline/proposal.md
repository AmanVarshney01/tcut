## Why

tcut works end to end but can only be run from a checkout. Users need an install path that matches their
setup (Bun users via npm, everyone else via a standalone binary) and a clear statement of what their machine needs.

## What Changes

- MIT license; publishable `package.json` (`files`, `engines`, metadata); repo made public.
- `scripts/build-binaries.ts`: cross-compiled binaries for darwin (arm64, x64), linux (x64, arm64), windows (x64) + `SHA256SUMS`.
- `release.yml`: on `v*` tags — verify tag == package version, build all binaries, create a GitHub Release, publish to npm when `NPM_TOKEN` is configured.
- README: Install (npm / binary) and Requirements matrix per feature.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `distribution`: release automation, multi-platform binaries, npm package contents.

## Impact

`package.json`, `LICENSE`, `scripts/build-binaries.ts`, `.github/workflows/release.yml`, `README.md`.
