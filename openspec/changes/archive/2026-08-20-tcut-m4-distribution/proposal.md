## Why

tcut should install as one binary and prove itself with a demo it made. CI must protect the recorder/renderer
contract on macOS, where the WebView path actually runs.

## What Changes

- Prebuilt renderer/player bundles in `src/renderer/generated/` (via `bun run build:assets`) embedded with
  `with { type: "file" }` so `bun build --compile` produces a self-contained `dist/tcut` binary.
- `tcut init [name] --template basic|tour|test` templates.
- `examples/readme.ts` generates `docs/demo.gif` + `docs/demo.svg` shown in the README.
- GitHub Actions workflow on macOS: install Bun + ffmpeg, typecheck, `bun test`, render the demo, build the binary.
- Private GitHub repository.

## Capabilities

### New Capabilities
- `distribution`: compiled binary, embedded assets, init templates, CI.

### Modified Capabilities
- none

## Impact

`scripts/build-assets.ts`, `src/renderer/bundle.ts`, `src/cli.ts`, `.github/workflows/ci.yml`, `docs/`, `package.json` scripts.
