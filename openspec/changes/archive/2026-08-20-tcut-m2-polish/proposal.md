## Why

M1 proved the pipeline. Before adding exporters we need the rendering options that users will reach for first
to actually be exposed and verified: every encoder, the remaining chrome/typography flags, a faster emulator
option, and frame-stable timestamps.

## What Changes

- Verify and fix `.webm`, `.webp` and PNG-sequence outputs; multi-output from one pass.
- New config: `core: "ghostty" | "lite"` (lite = wterm's Zig core: faster, palette-index colours, no query replies).
- New config: `quantize` — snap recorded timestamps to the `1/fps` grid so identical output yields identical casts.
- CLI flags: `--margin-fill`, `--line-height`, `--letter-spacing`, `--cast`, `--record-only`, `--core`.
- Mid-recording `resize()` renders correctly (terminal grid changes inside a fixed frame).

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `video-rendering`: lite core option; verified encoders; mid-cast resize behaviour.
- `session-recording`: `quantize` timestamps; `core` selection for the headless screen model.
- `cli`: new override flags and `--record-only`.

## Impact

`src/types.ts`, `src/config.ts`, `src/screen.ts`, `src/recorder.ts`, `src/renderer/*`, `src/cli.ts`, tests.
No new dependencies.
