## Why

The things VHS can't do are what make tcut worth using: outputs that need no ffmpeg or browser (animated SVG
for READMEs, a self-contained HTML player), scripts that run as tests, and not re-recording when nothing changed.

## What Changes

- `.svg` output: animated SVG built directly from the headless Ghostty grid — pure Bun, no WebView, no ffmpeg.
- `.html` output: single-file player embedding the cast and the wterm lite core, with play/pause/loop.
- `tcut test <script|dir…>`: run scripts in fast mode (no typing delay, no sleeps), no rendering, non-zero exit on failure; TAP-style summary.
- Cast caching: `cache: true` (default) skips recording when the script source + record config hash matches the existing cast; `--force` overrides.

## Capabilities

### New Capabilities
- `svg-export`: animated SVG exporter from the cell grid.
- `html-export`: self-contained HTML player export.
- `script-testing`: `tcut test` runner and fast mode.

### Modified Capabilities
- `session-recording`: script hash in the cast header; cache check before recording.
- `cli`: `test` command, `--force`.

## Impact

New modules `src/export/svg.ts`, `src/export/html.ts`, `src/renderer/player-entry.ts`, `src/testing.ts`;
changes to `src/video.ts`, `src/cli.ts`, `src/recorder.ts`. No new dependencies.
