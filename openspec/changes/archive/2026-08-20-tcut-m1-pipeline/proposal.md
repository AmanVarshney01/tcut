## Why

Terminal demos for READMEs and docs are still made by hand-recording a screen or by VHS-style DSLs that are
not programmable and not reproducible. Bun 1.4 shipped a PTY (`Bun.Terminal`) and a headless browser
(`Bun.WebView`), and wterm ships libghostty as a headless WASM `TerminalCore`; together they let us build
a TypeScript-scripted, deterministic terminal video maker with almost no native dependencies.

## What Changes

- New `tcut` package: `defineVideo(config, async t => …)` TypeScript API for scripting a terminal session.
- Recorder: drives a clean shell in a `Bun.Terminal` PTY, feeds output through a headless Ghostty core so
  scripts can `wait()` / `expect()` / `run()` against the real screen, and writes an asciicast v2 `.cast`.
- Renderer: replays a `.cast` on a virtual clock into `@wterm/dom` inside `Bun.WebView`, screenshots one
  frame per tick, and pipes frames to ffmpeg (mp4 in M1; gif/webm/webp and PNG sequence as stretch).
- Theming via OSC 4 palette injection + CSS variables; window padding/margin/radius/bar; deterministic cursor blink.
- CLI: `tcut <script.ts>`, `tcut record`, `tcut render <cast>`, `tcut init`, `tcut themes`.
- Replaces the xterm-based draft in `src/` with the wterm/ghostty stack.

## Capabilities

### New Capabilities
- `script-api`: the `defineVideo` config and the `t` session object (typing, keys, run/wait/expect, hide, screenshot, resize).
- `session-recording`: PTY driving, clean-shell setup, screen-model-driven waits, asciicast output with markers.
- `video-rendering`: cast → visible timeline → frames → encoded outputs; theming and window chrome.
- `cli`: the `tcut` command surface and its flags/overrides.

### Modified Capabilities
- none (greenfield)

## Impact

- New runtime deps: `@wterm/core`, `@wterm/dom`, `@wterm/ghostty` (pure JS + WASM). External tool: `ffmpeg` for video containers.
- Requires Bun ≥ 1.4 (`Bun.Terminal`, `Bun.WebView`, `Bun.build`). Frame rasterisation needs macOS (WKWebView) or Chrome/Edge elsewhere.
- Code: `src/` (recorder, renderer, cli, themes, cast), `examples/`, `package.json` bin `tcut`.
