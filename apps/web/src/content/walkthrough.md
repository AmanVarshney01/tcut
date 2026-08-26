## !!steps One file is the whole video

`defineVideo` takes the config and a script. Everything the video needs — size, theme, outputs — lives here, next to the code it demonstrates.

```ts ! demo.video.ts
import { defineVideo } from "tcut";

// !focus(1:3)
export default defineVideo(
  { output: ["demo.mp4", "demo.gif"] },
  async (t) => {
  },
);
```

## !!steps run() waits for your prompt

It types the command, presses Enter, and returns when the prompt is back — not after a guessed sleep. Fast machine or slow CI, the video looks the same.

```ts ! demo.video.ts
import { defineVideo } from "tcut";

export default defineVideo(
  { output: ["demo.mp4", "demo.gif"] },
  async (t) => {
    // !focus
    await t.run("bun --version");
  },
);
```

## !!steps expect() makes it a test

Assert on the rendered screen, including lines that already scrolled away. `tcut test` runs the same script with no delays and fails the build when the screen does not match.

```ts ! demo.video.ts
import { defineVideo } from "tcut";

export default defineVideo(
  { output: ["demo.mp4", "demo.gif"] },
  async (t) => {
    await t.run("bun --version");
    // !focus(1:2)
    await t.run("ls");
    await t.expect(/package\.json/);
  },
);
```

## !!steps snapshot() is a still of this moment

A PNG or SVG of the exact frame, written on every render — README screenshots that can never go stale, because the script that renders the video also renders them.

```ts ! demo.video.ts
import { defineVideo } from "tcut";

export default defineVideo(
  { output: ["demo.mp4", "demo.gif"] },
  async (t) => {
    await t.run("bun --version");
    await t.run("ls");
    await t.expect(/package\.json/);
    // !focus
    await t.snapshot("files.svg");
  },
);
```

## !!steps timelapse() compresses the boring part

An install plays 8× faster — output included, not just the silence. `chapter()` marks it as an mp4 chapter and a cut point for `--split-chapters`.

```ts ! demo.video.ts
import { defineVideo } from "tcut";

export default defineVideo(
  { output: ["demo.mp4", "demo.gif"] },
  async (t) => {
    await t.run("bun --version");
    await t.run("ls");
    await t.expect(/package\.json/);
    await t.snapshot("files.svg");
    // !focus(1:2)
    await t.chapter("Install");
    await t.timelapse(() => t.run("bun add zod"), { speed: 8 });
  },
);
```

## !!steps print() is a caption, not a command

Markdown, rendered into the terminal without typing anything — headings, bold, links that stay clickable in SVG and HTML.

```ts ! demo.video.ts
import { defineVideo } from "tcut";

export default defineVideo(
  { output: ["demo.mp4", "demo.gif"] },
  async (t) => {
    await t.run("bun --version");
    await t.run("ls");
    await t.expect(/package\.json/);
    await t.snapshot("files.svg");
    await t.chapter("Install");
    await t.timelapse(() => t.run("bun add zod"), { speed: 8 });
    // !focus
    await t.print("## Done\n\nRender it: `tcut demo.video.ts`");
  },
);
```
