---
name: tcut
description: Record reproducible terminal videos (MP4/GIF/SVG/HTML) from TypeScript scripts or live sessions with the tcut CLI. Use when the user wants a terminal demo, CLI screencast, TUI recording, or animated terminal GIF for a README, website, or social post.
---

# tcut — terminal sessions to video

tcut records a real shell (PTY + headless Ghostty terminal) and renders deterministic videos. Scripts are plain TypeScript — no DSL. Same recording, same pixels, every time.

## Setup

```sh
bun add -g termcut   # Bun >= 1.4, installs the `tcut` command
```

MP4/GIF/WebM need `ffmpeg` on PATH. SVG and HTML players need nothing else. Everything supports `--json` for machine-readable results; never prompts.

## Two ways to record

**Scripted (preferred for agents)** — write `demo.video.ts`, run `tcut demo.video.ts`:

```ts
import { defineVideo } from "tcut";

export default defineVideo(
  { output: ["demo.mp4", "demo.gif"], preset: "x", theme: "Catppuccin Mocha", keys: true, maxPause: "1.5s" },
  async (t) => {
    await t.run("bun --version");        // types it, presses Enter, waits for the prompt to return
    await t.expect(/1\.\d+/);            // asserts on the rendered screen (fails the video if absent)
    await t.sleep("1.5s");
  },
);
```

**Live** — `tcut rec -o demo.gif` opens a shell, records until `exit`, and writes both the exact recording (`demo.cast`) and an editable script (`demo.video.ts`) of what was typed. `tcut rec -o demo.mp4 -- npm create vite` records one command.

## The `t` API (inside defineVideo)

- `t.run(cmd, { wait? })` — type + Enter + wait for the shell prompt (screen-based, not a timer)
- `t.type(text)` / `t.paste(text)` / `t.enter()` / `t.escape()` / `t.tab()` — drive TUIs key by key
- `t.up/down/left/right/pageUp/pageDown/home/end()`, `t.ctrl("c")`, `t.alt("b")`, `t.shift("tab")`, `t.key("f5")`, `t.scrollUp/scrollDown()`
- `t.wait(regex?, { scope: "line" | "screen" })` — wait until the screen shows it; `t.expect(re)` — assert
- `t.sleep("800ms")` — durations accept `"500ms"`, `"1.5s"`, numbers (ms)
- `t.hide(async () => { ... })` — run setup off-camera (state persists; don't kill background jobs here)
- `t.print(markdown)` / `t.title(text)` — render Markdown captions into the video without typing
- `t.zoom({ rows: [0, 5], cols: [0, 60], duration: "500ms" })` — magnify a region; `t.zoom(null)` resets
- `t.chapter("Install")` — real MP4 chapter metadata
- `t.screenshot("shot.png")`, `t.clear()`, `t.resize(cols, rows)`, `t.screen()` / `t.line()` for reading the screen
- Browser pane: `browser: { position: "right" | "overlay", width }` in config, then `t.browser.goto(url)`, `t.browser.waitFor(/text/)`, `t.browser.click(sel)`, `t.focus("browser" | "terminal")` — records a real WebView beside/over the terminal (dev-server demos)

## Config essentials

`output` (array = multiple formats), `preset: "readme" | "x" | "youtube" | "square"`, `theme` (~600 Ghostty themes, `tcut themes`), `cols/rows` or `width/height` (px), `fps`, `typingSpeed`/`typingJitter`, `keys: true` (key-press overlay, one chip at a time; `{ limit, font, color, background, radius, position }`), `maxPause: "1.5s"` (idle compression), `windowBar: "none"` + `margin: 0` + `borderRadius: 0` for a bare terminal, `title`, `marginFill`.

## Render again without re-running

Recording (`.cast`) and rendering are separate:

```sh
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg
tcut render demo.cast --width 1280 --height 720 --speed 1.5 -o demo.mp4
```

## CI / testing

- `tcut test demo.video.ts` — run the script as a test (fast, no video encode)
- `tcut diff a.cast b.cast [--images dir]` — compare screen text of two recordings, exit 1 on drift

## Gotchas

- Background dev servers in the PTY: `bun run dev </dev/null >/tmp/dev.log 2>&1 &` (stdin-readers get SIGTTIN; stray logs repaint over TUIs)
- Wait on the screen, not on time: prefer `t.run` / `t.wait(/Local:/, { scope: "screen" })` over long sleeps
- `t.hide` keeps state — a hidden `kill` at the end leaks into the last frame
- For TUIs (nvim, lazygit, claude), launch with `t.run(cmd, { wait: /something-on-screen/ })`, then drive with keys

Full reference: https://tcut.amanv.dev/llms.txt
