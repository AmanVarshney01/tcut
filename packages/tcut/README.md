# tcut

Turn a terminal session into a video. Record it live or script it in TypeScript; render to MP4, GIF, SVG, HTML — identical every time.

![tcut demo](https://raw.githubusercontent.com/AmanVarshney01/tcut/main/packages/tcut/docs/demo.gif)

## Install

```sh
bun add -g termcut     # Bun ≥ 1.4 · installs the `tcut` command
```

Standalone binaries: [Releases](https://github.com/AmanVarshney01/tcut/releases). MP4/GIF need `ffmpeg`; SVG/HTML don't.

## Use

Record what you do:

```sh
tcut rec -o demo.gif                    # opens a shell, records until you `exit`
tcut rec -o demo.mp4 -- npm create vite # or just one command
```

You get `demo.gif`, the exact recording (`demo.cast`) and an editable script (`demo.video.ts`) of what you typed.

Or script it:

```ts
// demo.video.ts
import { defineVideo } from "tcut";

export default defineVideo({ output: "demo.gif" }, async (t) => {
  await t.run("bun --version");     // type, Enter, wait for the prompt
  await t.expect(/1\.\d+/);         // assert on the screen
  await t.sleep("1s");
});
```

```sh
tcut demo.video.ts
```

Record a real browser next to (or over) the terminal, for dev-server demos:

```ts
defineVideo({ output: "demo.mp4", browser: { position: "overlay" } }, async (t) => {
  await t.run("bun run dev </dev/null >/tmp/dev.log 2>&1 &");
  await t.browser.goto("http://localhost:5173");
  await t.run("sed -i '' 's/Hello/Hi/' src/App.tsx");   // HMR updates the page
  await t.focus("browser");
});
```

Polish: `shadow: true`, `watermark: "© you"`, `marginFill: "transparent"` (real alpha in PNG/WebP/GIF/WebM/SVG), `keys: true` shows key presses, `maxPause: "800ms"` cuts dead air, `t.timelapse(fn, { speed: 8 })` fast-forwards an install, `t.zoom({ rows: [0, 5] })` magnifies output, `t.chapter("Install")` adds mp4 chapters, `preset: "x"` sizes it for X. `tcut diff a.cast b.cast` catches output changes in CI.

Cut and join without re-recording — on the cast, so every format works:

```sh
tcut render demo.cast --from 2s --to 10s -o clip.gif     # a window of the video
tcut render demo.cast --split-chapters -o demo.mp4       # one file per t.chapter()
tcut concat intro.cast demo.cast --gap 500ms -o launch.mp4
```

Re-render any recording without re-running it — ~600 themes ([Ghostty's collection](https://github.com/mbadolato/iTerm2-Color-Schemes)), `tcut themes` lists them:

```sh
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg
```

Share it:

```sh
tcut publish --setup        # once: your S3-compatible bucket (RustFS, MinIO, R2, S3)
tcut publish demo.gif       # → https://…/3f9a1c2b7d4e/demo.gif
```

## Agents

```sh
npx skills add AmanVarshney01/tcut   # tcut + tcut-remotion skills for Claude Code, Cursor, etc.
```

Two skills: `tcut` (record terminal videos) and `tcut-remotion` (compose tcut footage into launch videos with [Remotion](https://remotion.dev)). Plus [llms.txt](https://tcut.amanv.dev/llms.txt) and `--json` everywhere.

## More

- [Examples](https://github.com/AmanVarshney01/tcut/tree/main/packages/tcut/examples) — driving an interactive TUI, recording Claude Code / Codex
- [Reference](https://github.com/AmanVarshney01/tcut/blob/main/packages/tcut/docs/REFERENCE.md) — every CLI flag and script option
- [llms.txt](https://tcut.amanv.dev/llms.txt) — the same, condensed for coding agents (`--json` gives machine-readable results)
- [tcut.amanv.dev](https://tcut.amanv.dev)

MIT
