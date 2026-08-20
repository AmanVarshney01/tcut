## 1. Project setup

- [x] 1.1 Rename package/bin to `tcut`; tsconfig path alias; swap deps to `@wterm/core`, `@wterm/dom`, `@wterm/ghostty`
- [x] 1.2 Add `openspec/config.yaml` project context (stack, conventions)

## 2. Shared modules

- [x] 2.1 `src/types.ts` — config, session, cast types (review against specs)
- [x] 2.2 `src/duration.ts`, `src/keys.ts`, `src/themes.ts`, `src/config.ts` — defaults, prompt pattern, overrides
- [x] 2.3 `src/cast.ts` — asciicast v2 read/write + marker constants

## 3. Recorder

- [x] 3.1 `src/screen.ts` — `Screen` over `GhosttyCore` (write, line/screen/cursor, absolute line, response drain, resize)
- [x] 3.2 `src/recorder.ts` — Bun.Terminal spawn, clean shell setups, `t` API, run/wait/expect, hide markers, response pump, teardown
- [x] 3.3 Smoke test: record `examples/demo.ts` to `.cast`; verify prompt detection, hide markers, expect failure path (`tests/recorder.test.ts`)

## 4. Renderer

- [x] 4.1 `src/renderer/page.ts` + `page-entry.ts` — page for `@wterm/dom` + Ghostty, CSS (theme vars, padding, bar, radius), `__vt.boot/measure/layout/applyUrl/writeUrl/cursor`
- [x] 4.2 `src/renderer/bundle.ts` — `Bun.build` ESM bundle (cached) + asset paths (wasm, css)
- [x] 4.3 `src/renderer/webview.ts` — timeline builder, OSC theme injection (+ re-inject on `ESC c`), virtual-clock frame loop, dedupe, screenshots
- [x] 4.4 `src/renderer/encoder.ts` — ffmpeg sinks (mp4/gif/webm/webp) + PNG sequence sink
- [x] 4.5 Verify: render demo cast to mp4; inspect first/middle/last frames visually; check colours match theme (fixed `--term-row-height` measurement loop)

## 5. CLI and API surface

- [x] 5.1 `src/video.ts` — `Video`, `defineVideo`, `renderCast`, `isVideo`
- [x] 5.2 `src/cli.ts` — run / record / render / init / themes, flag overrides, progress, error output
- [x] 5.3 `src/index.ts` exports; typecheck passes (`bunx tsc --noEmit`)

## 6. End-to-end

- [x] 6.1 `tcut examples/demo.ts` produces `out/demo.mp4` + `out/demo.gif` + screenshot; `tcut render` re-renders with `--theme dracula`
- [x] 6.2 README: install, quick start, API summary, how it differs from VHS
- [x] 6.3 Update `PLAN.md` status; archive change with `openspec archive`
