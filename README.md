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

Re-render any recording without re-running it — ~600 themes ([Ghostty's collection](https://github.com/mbadolato/iTerm2-Color-Schemes)), `tcut themes` lists them:

```sh
tcut render demo.cast --theme "Gruvbox Dark" -o demo.svg
```

Share it:

```sh
tcut publish --setup        # once: your S3-compatible bucket (RustFS, MinIO, R2, S3)
tcut publish demo.gif       # → https://…/3f9a1c2b7d4e/demo.gif
```

## More

- [Examples](https://github.com/AmanVarshney01/tcut/tree/main/packages/tcut/examples) — driving an interactive TUI, recording Claude Code / Codex
- [Reference](https://github.com/AmanVarshney01/tcut/blob/main/packages/tcut/docs/REFERENCE.md) — every CLI flag and script option
- [tcut.amanv.dev](https://tcut.amanv.dev)

MIT
