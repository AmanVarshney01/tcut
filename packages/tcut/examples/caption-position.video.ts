import { defineVideo } from "termcut";

// bun packages/tcut/src/cli.ts packages/tcut/examples/caption-position.video.ts
export default defineVideo({
  output: ["out/caption-position.mp4", "out/caption-position.html", "out/caption-position.svg"],
  width: 960, height: 600, fps: 30, typingSpeed: 0, endPause: 0,
  windowBar: "colorful", title: "tcut / subtitle positioning", cursor: { blink: false },
}, async (t) => {
  await t.run("echo 'Keep subtitles clear of your video player controls.'");
  await t.caption("Default: 16px from the bottom", { style: "classic" });
  await t.sleep("1.5s");
  await t.caption("Raised above the controls", { style: "tiktok", offset: 64 });
  await t.snapshot("out/caption-position-raised.png");
  await t.sleep("2s");
  await t.caption("Or place them near the top", { style: "pop", position: "top", offset: 48 });
  await t.sleep("1.5s");
});
