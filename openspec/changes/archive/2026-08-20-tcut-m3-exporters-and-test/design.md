## Context

Rendering currently requires Bun.WebView + ffmpeg. The headless Ghostty core already gives us the full cell grid
in Bun, which is enough to emit vector output and to drive a browser-side player.

## Goals / Non-Goals

**Goals:** SVG and HTML outputs with zero external tools; scripts runnable as tests; no redundant recordings.
**Non-Goals:** SVG cursor blink animation (static block), HTML player with Ghostty (size), seeking UI.

## Decisions

- **SVG = strip of frames + `steps()` animation.** Each unique grid becomes a `<g transform="translate(i·W,0)">`
  inside a clip; one `@keyframes` moves the strip with `steps(1,end)` at the frames' cumulative times. This is the
  same technique as svg-term/termtosvg, needs no JS, and GitHub renders it. Rows are emitted as `<text>` with
  `<tspan>` runs per colour/attribute; backgrounds as merged `<rect>` runs. Fixed cell width avoids font-metric
  dependence; `font-family` is embedded as a CSS stack.
- **HTML player uses the lite core** (inline 18 KB WASM, CSS-var themes) so the file stays small; bundle built with
  `Bun.build` into `src/renderer/generated/` like the renderer page. Events are embedded as JSON in a `<script type="application/json">`.
- **`tcut test` reuses the recorder with `fast: true`**; `sleep()` becomes a no-op and typing delay 0. Tests run
  sequentially (each spawns a shell). Output is TAP-like for readability; exit code is the contract.
- **Cache key** = SHA-256 of script file bytes + JSON of the record-relevant config (shell, prompt, cols, rows, env,
  cwd, typingSpeed/jitter/seed, quantize, fps, endPause, core). Stored as `scriptHash` in the cast header.

## Risks / Trade-offs

- [SVG size for long typing-heavy casts] → dedupe identical grids; only non-empty rows are emitted; document `playbackSpeed` + shorter demos.
- [Scripts importing other files change without the entry file changing] → cache misses aren't detected; `--force` documented.
