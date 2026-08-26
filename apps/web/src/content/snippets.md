```sh !rec
tcut rec -o demo.gif
tcut rec -o demo.mp4 -- npm create vite
```

```sh !test
tcut test demo.video.ts
tcut diff a.cast b.cast
```

```ts !browser
defineVideo({ output: "demo.mp4", browser: { position: "overlay" } }, async (t) => {
  await t.run("bun run dev </dev/null >/tmp/dev.log 2>&1 &");
  await t.browser.goto("http://localhost:5173");
  await t.run("sed -i '' 's/Hello/Hi/' src/App.tsx");
  await t.focus("browser");
});
```

```ts !vhs
import { defineVideo } from "tcut";

export default defineVideo({ output: "demo.gif" }, async (t) => {
  // !callout[/run/] returns when your prompt is back — VHS sleeps for a guessed duration
  await t.run("bun install");
  // !callout[/expect/] asserts on the rendered screen; `tcut test` runs it in CI
  await t.expect(/installed/);
  // !callout[/for/] plain TypeScript: loops, imports, shared scenes, autocomplete
  for (const file of ["a.ts", "b.ts"]) await t.run(`bun ${file}`);
});
```

```ts !library
import { defineVideo, renderCast } from "termcut";

const video = defineVideo({ output: ["demo.mp4", "demo.gif"] }, async (t) => {
  await t.run("bun --version");
  await t.expect(/1\.\d+/);
});
// !mark
const { outputs, screenshots } = await video.run({ log: console.log });

await renderCast("old.cast", { output: ["old.webm"], width: 1280, height: 720 });
```
