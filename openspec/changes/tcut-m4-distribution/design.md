## Context

The renderer bundles its page at runtime with `Bun.build` from `node_modules`, which a compiled binary won't have.

## Goals / Non-Goals

**Goals:** one binary; dev ergonomics unchanged; README demo produced by tcut itself; macOS CI.
**Non-Goals:** npm publish, Linux/Windows binaries (WebView needs Chrome there; untested), code signing.

## Decisions

- **Two-tier assets.** `scripts/build-assets.ts` writes `src/renderer/generated/{page.js,player.js,ghostty-vt.wasm,terminal.css}`.
  `src/renderer/embedded.ts` statically imports them `with { type: "file" }` (embedded by `bun build --compile`).
  `bundle.ts` tries `import("./embedded")` first and falls back to a runtime `Bun.build` when the generated directory is
  missing, so a fresh clone works without a build step. `generated/` is git-ignored; `prepare` runs the build on install.
- **README media lives in `docs/`** and is committed (small GIF + SVG) so the README renders on GitHub.
- **CI on macOS only** because that's where the WebView path is exercised; ffmpeg via Homebrew.

## Risks / Trade-offs

- [Bun compile not embedding dynamically imported modules] → verified by running the binary from an empty temp dir in CI.
- [Homebrew ffmpeg install time in CI] → acceptable (~1 min); cache later if needed.
