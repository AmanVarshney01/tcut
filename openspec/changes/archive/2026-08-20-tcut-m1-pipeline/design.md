## Context

Greenfield. Feasibility was measured on Bun 1.4.0 / macOS arm64 (see `PLAN.md` §1): `Bun.Terminal` PTY works;
`GhosttyCore` (libghostty WASM) runs headless in Bun with cell-level read access and answers terminal queries;
`@wterm/dom` renders inside `Bun.WebView` at ~33 ms per frame; Ghostty honours OSC 4 palette changes, so themes
can be injected into the emulator. `Bun.Image` cannot draw text or expose raw pixels. ffmpeg 8 is available.

## Goals / Non-Goals

**Goals:**
- TypeScript-first scripting with real screen-aware waits and assertions.
- Reproducible output: record once to `.cast`, render deterministically as many times as needed.
- Bun built-ins wherever they exist; only wterm (JS + WASM) and ffmpeg beyond that.
- mp4 end-to-end in M1 with the CLI; gif/webm/webp/png-seq as the same frame pass.

**Non-Goals (this change):**
- Animated SVG / HTML exporters, `tcut test`, cast caching, the pure-Bun glyph-atlas rasterizer (later changes).
- Windows/Linux verification (WebView there needs Chrome; recorder should work, untested).
- A `.tape`-compatible DSL.

## Decisions

1. **Record ≠ render, with asciicast v2 in between.** Rendering replays the cast on a virtual clock instead of
   screenshotting live. Rationale: determinism, re-theming without re-running commands, interop with asciinema
   tooling. Alternative (VHS-style live capture) rejected: output depends on machine speed.
2. **Ghostty core as the single screen model.** Used by the recorder (waits/expect) and, via `@wterm/dom`, by the
   renderer. Alternatives: `@xterm/headless` + xterm.js (two emulators, no shared grid, weaker VT fidelity);
   wterm's lite Zig core (fast but palette-index colours only and no query responses — kept as a future `core: "lite"` option).
3. **Rasterize with `Bun.WebView` + `@wterm/dom`.** Zero native deps on macOS; real font shaping (CJK, emoji,
   ligatures); window chrome is CSS. Alternative `@napi-rs/canvas` rejected for now (native addon, manual glyph
   handling); revisit as an optional fast renderer.
4. **Page bundle built at runtime with `Bun.build({ format: "esm" })`** and served by `Bun.serve` on 127.0.0.1.
   Ghostty's loader uses `import.meta.url`, so IIFE/classic scripts fail; the WASM is served as a route. Large
   payloads go to the page via `fetch()` from the local server, never through `evaluate()` template strings.
5. **Theme injection = CSS vars + OSC sequences.** `@wterm/dom` uses `fgRgb` when Ghostty supplies it, so CSS vars
   alone are not enough; OSC 4/10/11 are written before replay and re-written after any `ESC c`.
6. **Cursor blink from the render clock.** `.wterm.focused` is added manually for a filled cursor; blink is a CSS
   override toggled per tick, never a CSS animation.
7. **Prompt detection for `run()`** = prompt regex on cursor line AND (absolute cursor line changed OR line text differs
   from the echoed command). Covers `clear`, empty-output commands and commands whose output lacks a trailing newline.
8. **Frame dedupe** = skip the screenshot when no `o`/`r` event and no blink change landed in the tick.

## Risks / Trade-offs

- [Ghostty parse ≈ 220 KB/s] → fine for typical casts; chatty TUIs take seconds to replay; `core: "lite"` later.
- [~30 fps render throughput] → 60 fps output renders at ≤ 2× real time; dedupe makes idle time free.
- [Prompt heuristics vs exotic prompts] → `promptPattern` override; timeout errors always print the screen.
- [WebView needs Chrome off-macOS] → documented; same constraint as VHS.
- [`ESC c` / `reset` wipes the injected palette] → detect `\x1bc` in event data and re-inject.

## Migration Plan

Greenfield; replace the xterm-based draft files in `src/` in place. No rollback concerns.

## Open Questions

- Whether to expose `core: "lite"` already in M1 (cheap) or defer — default: defer.
