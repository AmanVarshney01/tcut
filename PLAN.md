# tcut — plan

> **Status (2026-08-20):** M1–M4 shipped. Record via Bun.Terminal + headless Ghostty; render via Bun.WebView +
> @wterm/dom → ffmpeg (mp4/gif/webm/webp/png-seq), plus pure-Bun animated SVG, single-file HTML player, PNG/JPG
> stills (`Bun.Image`); `tcut test` fast-mode runner; cast caching (`Bun.CryptoHasher`); `core: "lite"`; `quantize`;
> `bun build --compile` binary with embedded assets; macOS CI. OpenSpec changes `tcut-m1…m4` archived into
> `openspec/specs/`. Remaining ideas: Linux/Windows verification, glyph-atlas rasterizer, npm publish.

Script terminal sessions in **TypeScript**, render them to **reproducible** videos. VHS is the reference,
not the template: typed scripts instead of `.tape`, deterministic output, re-render without re-recording,
more output formats, and a Bun-native stack.

## 1. Stack (decided by measurement on Bun 1.4.0 / macOS arm64)

| Stage | Choice | Evidence | Fallback / note |
|---|---|---|---|
| PTY | `Bun.Terminal` (via `Bun.spawn({ terminal })`) | write / resize / exit callback verified | — |
| Screen model (bytes → cell grid) | **`@wterm/ghostty`** `GhosttyCore` — libghostty compiled to WASM, implements wterm's `TerminalCore` | runs headless in Bun, 19 ms load, `getCell()` returns char + resolved RGB + flags + width, answers terminal queries (`ESC[c` → `ESC[?1;2c`) which vim/htop need | `@wterm/core` `WasmBridge` (~18 KB, 135× faster writes, but palette-index colors only, no query responses). Expose as `core: "ghostty" \| "lite"` |
| Rasterizer (grid → pixels) | **`Bun.WebView`** (WKWebView, zero deps on macOS) hosting `@wterm/dom`, bundled with `Bun.build` (must be ESM — ghostty loader uses `import.meta.url`) | 33 ms per write+paint+screenshot ≈ 30 fps; JetBrains Mono, CJK, emoji, bold/inverse/underline all render correctly | Linux/Windows need Chrome/Edge for WebView (same constraint VHS has). Phase-3 option: pure-Bun glyph-atlas rasterizer (needs our own PNG decode — `Bun.Image` has no raw pixel access) |
| Encoder | `ffmpeg` piped PNG frames → mp4 / webm / gif / webp | ffmpeg 8.1 present | PNG sequence + animated SVG need **no ffmpeg and no WebView** |
| Not used | `@xterm/headless`, xterm.js, node-pty, Chrome+rod, sharp | superseded by the above | draft in `src/` still uses xterm — to be swapped |

Why wterm over xterm.js: one `TerminalCore` interface serves **both** the recorder (for `wait`/`expect`) and the
renderer (frame dedupe, SVG export), it is a cell grid we can read directly, and Ghostty gives the best VT
fidelity available in JS/WASM today.

Known gap to verify first in M1: `GhosttyOptions` only takes foreground/background, so the 16 ANSI colours
come out as Ghostty's defaults. Plan: push the theme into the emulator with OSC 4 (`ESC ] 4 ; n ; rgb:rr/gg/bb BEL`)
at init so `fgRgb` reflects our theme. If Ghostty ignores OSC 4, fall back to `WasmBridge` (palette index → CSS vars).

## 2. Architecture: record ≠ render

```
script.ts ──▶ RECORD (live)  ──▶ session.cast ──▶ RENDER (offline, virtual clock) ──▶ demo.mp4 / .gif / .svg / frames/
              Bun.Terminal           asciicast v2        replay bytes into GhosttyCore
              sandboxed shell        + markers           sample grid every 1/fps
              GhosttyCore for        (hide/show,         skip screenshot when no row is dirty
              wait()/expect()        screenshot, custom) WebView+@wterm/dom → PNG → ffmpeg
```

- **Record** does only I/O. Clean shell (`bash --norc --noprofile`, `zsh -f`, `fish --no-config`), fixed `PS1`,
  `TERM=xterm-256color`, no history, `Env` from config. Every PTY chunk is timestamped into the cast *and* fed to
  the headless core so `wait()`, `expect()`, `run()` look at the real screen. Core responses (`getResponse()`)
  are pumped back into the PTY so TUIs that query the terminal don't hang.
- **Render** is a pure function of `(cast, render config)`. Hidden intervals are collapsed, playback speed
  applied, events replayed on a virtual clock, one frame per tick. Same cast + same config ⇒ identical frames
  on any machine, regardless of how fast it renders. Re-theme / resize-font without re-running commands.
- Optional `quantize: true` snaps recorded timestamps to the frame grid so even the cast is byte-stable across runs
  when command output is the same.
- The `.cast` is standard asciicast v2 → works with `asciinema play`, `agg`, asciinema-player.

## 3. Script API (TypeScript, the product surface)

```ts
import { defineVideo } from "bun-video";

export default defineVideo(
  {
    output: ["out/demo.mp4", "out/demo.gif"],   // extension picks encoder; "frames/" = PNG seq; ".svg" = animated SVG
    shell: "bash", prompt: "> ",
    cols: 80, rows: 24, fps: 60,
    typingSpeed: "40ms", typingJitter: 0.3, seed: 1,  // jitter is seeded → reproducible
    theme: "catppuccin-mocha", font: { family: "JetBrains Mono", size: 20 },
    windowBar: "colorful", title: "bun-video", padding: 20, margin: 32, borderRadius: 12,
  },
  async (t) => {
    await t.hide(() => t.run("cd /tmp && mkdir demo && cd demo"));   // scoped, not Hide/Show toggles
    await t.run("ls -la");                                           // type + Enter + wait for prompt
    await t.expect(/total \d+/);                                     // assertion → doubles as an integration test
    await t.type("vim notes.md"); await t.enter(); await t.wait(/-- INSERT --|~/, { scope: "screen" });
    await t.ctrl("c"); await t.screenshot("out/vim.png");
    await t.sleep("1.5s");
  },
);
```

`t` surface: `type run paste key enter tab backspace delete escape space up down left right home end pageUp pageDown
ctrl alt raw sleep wait expect hide screenshot marker resize clear screen() line() cursor()`.
Because it's TS: loops, helpers, `import` shared scenes, `Promise`s, env-driven branches, `bun test` integration.

## 4. CLI

```
bun-video <script.ts> [--theme … --font-size … --fps … --speed … -o …]   record + render
bun-video record <script.ts>            → .cast only
bun-video render <file.cast> [...]      → re-render any cast (ours or asciinema's)
bun-video test <script.ts|dir>          → run scripts, no video, non-zero exit on expect()/timeout failures
bun-video init [name] · bun-video themes
```
Ships as `bun build --compile` single binary (+ npm package with `bin`).

## 5. Output formats

| Format | Needs | Phase |
|---|---|---|
| `.cast` | nothing | M1 |
| `.mp4` `.webm` `.gif` `.webp` | WebView + ffmpeg | M1 (mp4), M2 (rest) |
| `frames/` PNG sequence | WebView | M2 |
| `.svg` animated (crisp, tiny, perfect for READMEs) | **nothing** — built from the cell grid | M3 |
| `.html` self-contained player (`@wterm/dom` + cast) | nothing | M3 |

## 6. Milestones

- **M0 — spike (done).** All measurements above. Draft scaffold in `src/` (types, recorder, cast, CLI) written
  against xterm; reusable structure, emulator to be swapped.
- **M1 — pipeline.** `defineVideo` → record (Bun.Terminal + GhosttyCore) → `.cast` → render (WebView + `@wterm/dom`)
  → `.mp4`. CLI `run` / `record` / `render`. OSC 4 theming verified. One example that runs end to end.
- **M2 — quality.** gif/webm/webp/png-seq, themes, window bar, padding/margin/radius, deterministic cursor blink,
  `screenshot()`, `resize()`, frame dedupe via dirty rows, progress output, errors that print the screen.
- **M3 — differentiators.** Animated SVG + HTML exporters, `bun-video test`, `quantize`, cast caching
  (skip re-record when script hash + env unchanged), `core: "lite"` switch.
- **M4 — ship.** Compiled binary, `init` templates, README with a video made by itself, CI on macOS.

## 7. Risks / open questions

1. Ghostty palette theming via OSC 4 — verify first thing in M1 (fallback documented above).
2. Ghostty write throughput ≈ 220 KB/s: a very chatty TUI recording (several MB) takes seconds to replay; fine,
   and `core: "lite"` exists for that case.
3. Render throughput ≈ 30 fps ⇒ a 20 s clip at 60 fps renders in ~40 s worst case; dirty-row dedupe makes idle
   stretches free. Glyph-atlas rasterizer is the escape hatch if this ever matters.
4. Prompt detection for custom shells/prompts — `promptPattern` override + clear timeout errors with screen dump.
5. Non-macOS WebView requires Chrome — document; same as VHS.

## 8. Decisions needed

- Default core: Ghostty (fidelity) vs lite (speed/theming simplicity) — recommendation: Ghostty, lite as option.
- Package / CLI name (`bun-video`?).
- M1 scope as above, or fold gif + themes into M1.
