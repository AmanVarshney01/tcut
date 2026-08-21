import { defineVideo } from "tcut";

// Produces the media embedded in README.md and on the site: `bun src/cli.ts examples/readme.ts`, then `bun run media` in apps/web.
// tcut recording tcut: show a script, run it, list what came out. The script text is real text in the SVG/HTML outputs — select it, copy it.
export default defineVideo(
  {
    output: ["docs/demo.gif", "docs/demo.svg", "docs/demo.png"],
    theme: "catppuccin-mocha",
    cols: 80,
    rows: 27,
    cursor: { blink: false }, // every blink is a frame in the SVG; keep the file small
    fps: 30,
    typingSpeed: "35ms",
    typingJitter: 0.35,
    windowBar: "colorful",
    title: "tcut",
    padding: 18,
    margin: 28,
    borderRadius: 12,
    marginFill: "#11111b",
    font: { size: 18 },
    waitTimeout: "180s",
  },
  async (t) => {
    await t.hide(async () => {
      await t.run("cd $(mktemp -d) && export BAT_STYLE=plain BAT_PAGER=cat");
      await t.run(`cat > demo.video.ts <<'TS'
import { defineVideo } from "tcut";

export default defineVideo(
  { output: ["demo.mp4", "demo.svg"] },
  async (t) => {
    await t.run("bun --version");
    await t.run("echo 'hello from tcut'");
    await t.expect(/hello/); // assert on what is on screen
  },
);
TS`);
      await t.clear();
    });

    await t.run("bat demo.video.ts");
    await t.expect(/defineVideo/);
    await t.sleep("2.4s");

    await t.type("tcut demo.video.ts");
    await t.sleep("400ms");
    await t.enter();
    await t.hide(() => t.wait()); // the inner render's progress line would otherwise add ~170 unique frames
    await t.sleep("900ms");

    await t.run("du -h demo.*");
    await t.expect(/demo\.svg/);
    await t.sleep("2.8s");
  },
);
