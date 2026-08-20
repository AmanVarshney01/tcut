## Context

M1 shipped with Ghostty as the only core, flags for a subset of render options, and only mp4/gif verified.

## Goals / Non-Goals

**Goals:** every documented output format verified by tests; lite core as a first-class option; frame-stable casts.
**Non-Goals:** new output formats (M3), distribution (M4).

## Decisions

- **Core switch lives in config and the cast header.** Recorder picks `GhosttyCore` or `WasmBridge` behind the existing
  `Screen` class; the page entry receives `core` in its boot options and loads the matching WASM. With `lite`, skip
  OSC palette injection (the lite core reports palette indices, so CSS variables already apply).
- **Quantize at record time**, rounding up to the next frame boundary, so a quantized cast renders identically
  on any fps that divides the recording fps and the cast itself is stable across runs with identical output.
- **Resize inside a fixed frame**: the page keeps `#term` at its initial pixel size; wterm reflows the grid
  within it. This matches how a real window behaves when a program changes the grid.
- **Encoder tests render a tiny synthetic cast** (two events) to every format and probe with `ffprobe` where
  available, keeping the suite fast (~ seconds).

## Risks / Trade-offs

- [webp/vp9 encoders missing from a user's ffmpeg build] → surface ffmpeg's stderr verbatim in the error.
- [lite core lacks DA replies] → documented; programs that wait for replies will time out under `lite`.
