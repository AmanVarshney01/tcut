# tcut

Terminal videos, written in TypeScript. Record a session live or script it, then render it to MP4, GIF, WebM, SVG or HTML — the same recording gives the same pixels every time.

![tcut demo](https://raw.githubusercontent.com/AmanVarshney01/tcut/main/packages/tcut/docs/demo.gif)

[tcut.amanv.dev](https://tcut.amanv.dev) · [Reference](https://github.com/AmanVarshney01/tcut/blob/main/packages/tcut/docs/REFERENCE.md) · [Examples](https://github.com/AmanVarshney01/tcut/tree/main/packages/tcut/examples) · [llms.txt](https://tcut.amanv.dev/llms.txt)

## Install

```sh
bun add -g termcut        # Bun ≥ 1.4 · installs the `tcut` command
```

Or a standalone binary for macOS, Linux or Windows from [Releases](https://github.com/AmanVarshney01/tcut/releases) — all three are tested in CI.

- MP4, GIF, WebM, WebP need `ffmpeg` on the PATH. SVG, HTML and text outputs need nothing.
- Linux and Windows render pixels through Chrome or Chromium (`BUN_CHROME_PATH` to point at one).

## Record

**Live.** Your own shell opens — prompt, config, aliases — in your terminal's colours and font (`theme: "auto"`, `font: "auto"`: asked from the terminal itself); type; `exit`. You get the video, the exact recording (`demo.cast`) and an editable script of what you typed (`demo.video.ts`): it reopens your shell (`shell: "user"`), waits for your prompt (`promptPattern`, detected from the recording) and replays the commands as `run()` calls. `--clean` opens a plain shell with a `>` prompt instead.

```sh
tcut rec -o demo.gif
tcut rec -o demo.mp4 -- npm create vite     # one command, ends when it exits
```

`-- command` runs through that same shell, so `tcut rec -- ls` records what *your* `ls` shows — aliases, functions, fish abbreviations and colours included. `--raw` runs the binary directly.

**Scripted.** Plain TypeScript, so loops, helpers and imports work, and the script lives in the repo next to the code it shows.

```ts
// demo.video.ts
import { defineVideo } from "tcut";

export default defineVideo({ output: ["demo.mp4", "demo.gif"] }, async (t) => {
  await t.run("bun --version");       // types it, presses Enter, waits for the prompt
  await t.run("ls -la");
  await t.expect(/package\.json/);    // asserts on the screen — the demo is a test
  await t.snapshot("files.png");      // a still of this exact moment
  await t.sleep("1.5s");
});
```

```sh
tcut demo.video.ts
```

What a script can do, one line each:

| | |
|---|---|
| `run(cmd)` | waits for your prompt to come back, not for a timer |
| `wait(/re/)` · `expect(/re/)` | observe or assert the screen — including lines that already scrolled away (`{ scope: "scrollback" }`) |
| `type` · `enter` · arrows · `ctrl("c")` · `key("f5")` | keys, sent the way the running program asked for them |
| `hide(fn)` | runs setup off-camera; the state stays |
| `snapshot("x.png" \| "x.svg")` | a pixel or vector still of that exact moment, written on every render |
| `chapter(name)` | mp4 chapters, and cut points for `--chapters` / `--split-chapters` |
| `print(markdown)` · `title(text)` | captions rendered into the terminal, nothing typed |
| `zoom({ rows, cols })` | magnifies a region; `keys: true` shows what was pressed |
| `timelapse(fn, { speed })` | fast-forwards an install or a build, not just the silence |
| `browser` | a real browser window beside or over the terminal (below) |

The full surface is in the [reference](https://github.com/AmanVarshney01/tcut/blob/main/packages/tcut/docs/REFERENCE.md).

## Render again

Recording and rendering are separate. A recording is an asciicast; frames are computed on a virtual clock. So a new theme, size or format never re-runs a shell — and cuts, joins and chapter splits happen on the recording, which is why they work for SVG as well as MP4.

```sh
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg -o demo.html
tcut render demo.cast --width 1280 --height 720 --speed 1.5 -o demo.mp4
tcut render demo.cast --from 2s --to 10s --shadow --watermark "@you" -o clip.gif
tcut render demo.cast --split-chapters --margin-fill transparent -o demo.webm
tcut concat intro.cast demo.cast --gap 500ms -o launch.mp4
tcut themes                                   # ~600 themes, Ghostty's collection
```

Outputs by extension: `.mp4` `.gif` `.webm` `.webp` · `.svg` (animated, real text) · `.html` (single-file player) · `.png` `.jpg` (final frame) · `.txt` (final screen) · `.log` (full transcript) · `dir/` (PNG frames).

## Faithful to the terminal

The emulator is Ghostty's core, so what tcut sees is what your terminal would show — and what it records is what the program actually received.

- Arrow keys and pastes arrive exactly as the running program asked: application cursor mode, bracketed paste.
- Links printed with OSC 8 — including Markdown links in `print()` captions — stay clickable in SVG and HTML.
- Frames are never torn: synchronized-output blocks are captured whole.
- Symbols the font lacks (progress blocks, Nerd Font icons) stay on their cell, so status bars never drift — and tcut bundles the Nerd Font symbols (the same file Ghostty embeds) as the last fallback, so icons render on any machine.
- `theme: "auto"` and `font: "auto"` render with the colours and font of the terminal you record in — the video looks like *your* terminal, not like a default.
- Kitty graphics (inline images) are rendered when using the Ghostty core (the default). Sixel and iTerm2 images are not supported.
- `tcut doctor demo.cast` explains what a recording used, including Kitty graphics and any protocols tcut cannot render.

## Test it

```sh
tcut test demo.video.ts        # runs the script with no delays — just the assertions
tcut diff a.cast b.cast        # catches output changes between two recordings
```

`expect()` makes a demo a test. `tcut test` runs it fast, and exits non-zero when the screen does not match — so the same script that renders your README video can guard it in CI.

## A browser next to the terminal

For dev-server demos: the page is recorded on the same clock and composited beside or over the terminal.

```ts
defineVideo({ output: "demo.mp4", browser: { position: "overlay" } }, async (t) => {
  await t.run("bun run dev </dev/null >/tmp/dev.log 2>&1 &");
  await t.browser.goto("http://localhost:5173");
  await t.run("sed -i '' 's/Hello/Hi/' src/App.tsx");   // HMR updates the page
  await t.focus("browser");
});
```

## Use it as a library

Everything the CLI does is an exported function — the site's own build records and renders its walkthrough frames from code.

```ts
import { defineVideo, renderCast } from "termcut";

const video = defineVideo({ output: ["demo.mp4", "demo.gif"] }, async (t) => {
  await t.run("bun --version");
  await t.expect(/1\.\d+/);
  await t.snapshot("version.svg");
});

const result = await video.run({ force: true, log: console.log });
// result.outputs, result.screenshots, result.durationSeconds, result.recording

const recording = await video.record();                 // just the .cast
await video.render(recording, { overrides: { theme: "Gruvbox Dark" }, clip: { from: 2, to: 10 } });

await renderCast("old.cast", { output: ["old.webm"], width: 1280, height: 720 });   // any cast, no shell
```

Also exported: `recordLive` (a live session under program control), `cutRecording` / `concatRecordings` / `selectChapters`, `buildSvg` / `buildHtml` / `replayFrames` (frames as a text grid, no pixels), `diffCasts`, `diagnoseCast`, `generateScript` (cast → script), `runScriptTests`, `publishFiles`, plus every type. Two things to know: `theme: "auto"` / `font: "auto"` read the terminal the process runs in, so in CI pass explicit values; and render one video at a time — each one drives a WebView.

## Share it

```sh
tcut publish --setup        # once: your own S3-compatible bucket (RustFS, MinIO, R2, S3)
tcut publish demo.gif       # → https://…/3f9a1c2b7d4e/demo.gif
```

There is no hosted service; you bring the bucket.

## For agents

```sh
npx skills add AmanVarshney01/tcut   # skills for Claude Code, Cursor, Codex, …
```

Two skills: `tcut` (record terminal videos) and `tcut-remotion` (compose tcut footage into a launch video with [Remotion](https://remotion.dev)). Every command has `--json`, exit codes and no prompts; [llms.txt](https://tcut.amanv.dev/llms.txt) is the condensed guide.

## Compared with VHS

[VHS](https://github.com/charmbracelet/vhs) is the reference point and the inspiration. Where tcut differs:

- **Scripts are TypeScript** — loops, imports, shared scenes, autocomplete — instead of a `.tape` DSL.
- **Waits on the screen** — `run()` returns when your prompt is back; VHS sleeps for a guessed duration.
- **Rendering never re-runs the shell** — a new theme, size or format is computed from the recording. VHS screenshots Chrome live, so output depends on machine speed.
- **Demos are tests** — `expect()` asserts on the screen; `tcut test` runs them in CI.
- **Same emulator as your terminal** — Ghostty's core in WASM, its themes, plus SVG and HTML outputs that need no ffmpeg or browser.

## How it works

1. **Record.** `Bun.Terminal` runs your shell in a PTY. Every byte is timestamped into a `.cast`.
2. **Watch.** The same bytes feed a headless [Ghostty](https://ghostty.org) (via [wterm](https://github.com/vercel-labs/wterm)). That is how `run()` knows the prompt is back and `expect()` sees what you see.
3. **Render.** The cast replays into the same terminal inside `Bun.WebView`, one frame per tick, straight to ffmpeg. SVG and HTML are built from the terminal grid, no browser involved.

## More

- [Examples](https://github.com/AmanVarshney01/tcut/tree/main/packages/tcut/examples) — driving an interactive TUI, recording Claude Code and Codex
- [Reference](https://github.com/AmanVarshney01/tcut/blob/main/packages/tcut/docs/REFERENCE.md) — every CLI flag and script option
- [tcut.amanv.dev](https://tcut.amanv.dev)

MIT
