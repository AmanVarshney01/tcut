# tcut

**Turn a terminal session into a video.** Record it live or script it in TypeScript; render it to MP4, GIF, WebM, SVG, HTML or PNG — identical every time.

[![npm](https://img.shields.io/npm/v/termcut)](https://www.npmjs.com/package/termcut)
[![CI](https://github.com/AmanVarshney01/tcut/actions/workflows/ci.yml/badge.svg)](https://github.com/AmanVarshney01/tcut/actions/workflows/ci.yml)
[![license](https://img.shields.io/github/license/AmanVarshney01/tcut)](LICENSE)

![tcut demo](https://raw.githubusercontent.com/AmanVarshney01/tcut/main/packages/tcut/docs/demo.gif)

Website: **[tcut.amanv.dev](https://tcut.amanv.dev)**

## Install

```sh
bun add -g termcut        # installs the `tcut` command (needs Bun ≥ 1.4)
bunx termcut --help       # or run it without installing
```

No Bun? Grab a standalone binary from [Releases](https://github.com/AmanVarshney01/tcut/releases) (macOS, Linux, Windows):

```sh
curl -fsSL https://github.com/AmanVarshney01/tcut/releases/latest/download/tcut-0.1.0-darwin-arm64 -o tcut && chmod +x tcut
```

For `.mp4` / `.gif` / `.webm` you also need `ffmpeg` (`brew install ffmpeg`, `apt install ffmpeg`). SVG, HTML and PNG need nothing else.

## Record a session

### Live — just do it, tcut records it

```sh
tcut rec -o demo.gif
```

A clean shell opens in your terminal. Type whatever you want to show; when you `exit`, tcut renders `demo.gif`.
Everything is captured — output, timing, colours, arrow keys in TUIs, window resizes.

```sh
tcut rec -o demo.mp4 -- bun create better-t-stack    # record just one command (you still drive it)
tcut rec -o demo.svg -o demo.gif                    # several formats from one session
```

### Scripted — write it once, re-record forever

```ts
// demo.video.ts
import { defineVideo } from "tcut";

export default defineVideo(
  { output: ["demo.mp4", "demo.gif"], theme: "catppuccin-mocha", cols: 80, rows: 20 },
  async (t) => {
    await t.run("bun --version");              // types it, presses Enter, waits for the prompt
    await t.run("ls -la");
    await t.expect(/package\.json/);           // assert on the screen — the demo is also a test
    await t.sleep("1.5s");
  },
);
```

```sh
tcut demo.video.ts            # record + render
tcut init demo                # scaffold a script to start from
```

Scripts are plain TypeScript: loops, helpers, imports, whatever you need. All output in the video comes from the
real programs; the script only provides the key presses a person would make.

## Render again, differently

Recording and rendering are separate. Every recording is saved as a standard [asciicast](https://docs.asciinema.org/manual/asciicast/v2/) (`demo.cast`) and frames are computed on a virtual clock, so the same cast renders to the same pixels on any machine — and you can re-render without re-running anything:

```sh
tcut render demo.cast --theme dracula -o demo.gif     # new theme
tcut render demo.cast -o demo.svg -o demo.html        # animated SVG for a README, single-file HTML player
tcut render demo.cast --font-size 24 --speed 1.5 -o demo.mp4
```

| Output | Needs | |
|---|---|---|
| `.mp4` `.webm` | ffmpeg | H.264 / VP9 |
| `.gif` `.webp` | ffmpeg | animated, palette-optimised |
| `.svg` | nothing | animated vector — crisp at any size, ~20 KB, renders on GitHub |
| `.html` | nothing | self-contained player with play / pause / loop |
| `.png` `.jpg` | — | the final frame (`t.screenshot()` for any moment) |
| `frames/` | — | one PNG per frame |

## Examples

| | |
|---|---|
| **Driving an interactive TUI** — answers `bun create better-t-stack` with arrow keys, picks options by reading the screen. [`better-t-stack.ts`](packages/tcut/examples/better-t-stack.ts) | ![better-t-stack](https://raw.githubusercontent.com/AmanVarshney01/tcut/main/packages/tcut/docs/examples/better-t-stack.gif) |
| **Recording AI agents** — `claude -p` explains a file, `codex exec` edits it. [`ai-agents.ts`](packages/tcut/examples/ai-agents.ts) | ![claude and codex](https://raw.githubusercontent.com/AmanVarshney01/tcut/main/packages/tcut/docs/examples/ai-agents.gif) |
| **README media** — the GIF at the top of this page. [`readme.ts`](packages/tcut/examples/readme.ts) | |

More in [`packages/tcut/examples/`](packages/tcut/examples).

## Use scripts as tests

```sh
tcut test examples/
```

Runs every script in fast mode (no typing delay, no sleeps), renders nothing, and exits non-zero if any
`expect()` fails — so the demo in your README is also the integration test for your CLI.

## CLI

```
tcut <script.ts>                  record + render
tcut rec [-- command…]            record a live session, then render
tcut record <script.ts>           record only (.cast)
tcut render <file.cast>           render a cast (tcut's or asciinema's)
tcut test <paths…>                run scripts as tests
tcut init [name] [--template basic|tour|test]
tcut themes

-o, --output <path>   repeatable: .mp4 .webm .gif .webp .svg .html .png .jpg or a directory/
--theme <name>        catppuccin-mocha · dracula · github-dark · tokyo-night · one-dark
--font <family>  --font-size <px>  --line-height <x>  --letter-spacing <px>
--fps <n>  --speed <x>  --padding <px>  --margin <px>  --margin-fill <color>  --radius <px>
--window-bar <none|colorful|colorfulRight|rings|ringsRight>  --title <text>  --no-blink
--core <ghostty|lite>  --cast <path>  --record-only  --force  -q
```

## Script reference

`defineVideo(config, async (t) => { … })`

**Config** (all optional except `output`)

| | default | |
|---|---|---|
| `output` | — | string or array; extension picks the format |
| `shell` | `"bash"` | `bash` · `zsh` · `fish` · `sh` · or a `string[]` command |
| `prompt` | `"> "` | prompt of the clean shell; `run()` waits for it |
| `cols` · `rows` · `fps` | 80 · 24 · 60 | |
| `typingSpeed` · `typingJitter` · `seed` | `"50ms"` · 0 · 1 | jitter is seeded, so it's reproducible |
| `theme` | `"catppuccin-mocha"` | a name or a full theme object |
| `font` | JetBrains Mono 20 px | `{ family, size, lineHeight, letterSpacing }` |
| `windowBar` · `title` · `padding` · `margin` · `marginFill` · `borderRadius` | `"none"` · `""` · 24 · 0 · bg · 0 | window chrome |
| `cursor` | `{ blink: true, period: 1000 }` | |
| `playbackSpeed` · `waitTimeout` · `endPause` | 1 · `"15s"` · `"1s"` | |
| `cache` · `quantize` · `core` | true · false · `"ghostty"` | skip re-recording when unchanged · frame-grid timestamps · emulator |

**`t`**

- Type: `run(cmd)` · `type(text)` · `paste(text)` · `enter()` `tab()` `backspace()` `escape()` `space()` `up()` `down()` `left()` `right()` `home()` `end()` `pageUp()` `pageDown()` (all take a count) · `ctrl("c")` · `alt("b")` · `key("f5")` · `raw(bytes)`
- Wait: `sleep("500ms")` · `wait(/re/, { scope: "line" | "screen" })` — default waits for the prompt
- Assert: `expect(/re/)` — throws with a screen dump
- Shape the video: `hide(async () => …)` cuts a section · `screenshot("x.png")` · `marker("name")` · `resize(cols, rows)` · `clear()`
- Look: `screen()` · `line()` · `cursor()` · `cols` · `rows`

Durations accept `500`, `"500ms"`, `"1.5s"`, `"2m"`.

## Requirements

| To… | You need |
|---|---|
| run tcut | Bun ≥ 1.4, or the standalone binary |
| record (`rec`, scripts, `test`) | a shell — nothing else |
| render `.svg` / `.html` | nothing else |
| render `.png` / `frames/` | macOS: nothing (built-in WebKit) · Linux / Windows: Chrome, Chromium, Edge or Brave |
| render `.mp4` / `.gif` / `.webm` | the above + ffmpeg |
| render `.webp` | ffmpeg with libwebp (`brew install ffmpeg-full`; found automatically) |

Verified on macOS. Linux and Windows binaries are cross-compiled and not yet exercised in CI.

## How it works, briefly

`Bun.Terminal` runs your shell in a PTY. Output is timestamped into the cast and also fed to a headless
[Ghostty](https://ghostty.org) terminal (via [wterm](https://github.com/vercel-labs/wterm)), which is how `run()` knows the prompt is back and
`expect()` sees what you see. Rendering replays the cast into that terminal inside `Bun.WebView` one frame at a time and hands the
frames to ffmpeg; SVG and HTML are built straight from the terminal grid. Inspired by [VHS](https://github.com/charmbracelet/vhs).

Contributing: see [CONTRIBUTING.md](CONTRIBUTING.md). MIT.
