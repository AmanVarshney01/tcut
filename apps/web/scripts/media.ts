// Regenerates the site's media from the tcut demo cast using tcut itself: `bun run media` (repo root or apps/web).
// Outputs land in src/assets/ and are committed, so the site builds without a WebView or ffmpeg.
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { readCast, renderOutputs, resolveConfig } from "termcut";

const web = path.resolve(import.meta.dir, "..");
const tcut = path.resolve(web, "..", "..", "packages", "tcut");
const assets = path.join(web, "src", "assets");
const cast = path.join(tcut, "docs", "demo.cast");

await mkdir(assets, { recursive: true });
const rec = await readCast(cast);
const base = rec.header.bunVideo;
if (!base) throw new Error("demo.cast has no embedded tcut config; re-record with examples/readme.ts");

// 1. Animated SVG + final-frame PNG. No window bar on the site: the terminal, nothing pretending to be a Mac.
await renderOutputs(rec, { ...base, windowBar: "none", title: "", output: [path.join(assets, "demo.svg"), path.join(assets, "demo.png")] });

// 2. Film strip: one frame per second, plain (no margin/bar) so the strip reads as frames.
const framesDir = path.join(web, ".media-frames") + "/";
await rm(framesDir, { recursive: true, force: true });
await renderOutputs(
  rec,
  resolveConfig({
    ...base,
    promptPattern: new RegExp(base.promptPattern),
    output: framesDir,
    fps: 1,
    margin: 0,
    borderRadius: 0,
    windowBar: "none",
    padding: 12,
    cursor: { blink: false },
    font: { ...base.font, size: 16 },
  }),
);
const files = (await readdir(framesDir)).filter((f) => f.endsWith(".png")).sort();
const stripDir = path.join(assets, "strip");
await rm(stripDir, { recursive: true, force: true });
await mkdir(stripDir, { recursive: true });
for (const [i, f] of files.entries()) {
  await Bun.write(path.join(stripDir, `t${String(i).padStart(2, "0")}.png`), Bun.file(path.join(framesDir, f)));
}
await rm(framesDir, { recursive: true, force: true });

// 3. Facts the page quotes (frame counts, sizes), so copy never drifts from the artefacts.
const { replayFrames } = await import("termcut");
const replay = await replayFrames(rec, base);
const facts = {
  durationSeconds: Number(replay.duration.toFixed(1)),
  totalFrames: Math.ceil(replay.duration * base.fps),
  uniqueFrames: replay.frames.length,
  fps: base.fps,
  stripFrames: files.length,
  hiddenSeconds: Number(
    (
      rec.events.filter((e) => e[1] === "m" && e[2] === "show").reduce((acc, e) => acc + e[0], 0) -
      rec.events.filter((e) => e[1] === "m" && e[2] === "hide").reduce((acc, e) => acc + e[0], 0)
    ).toFixed(1),
  ),
  svgBytes: Bun.file(path.join(assets, "demo.svg")).size,
  pngBytes: Bun.file(path.join(assets, "demo.png")).size,
  gifBytes: Bun.file(path.join(tcut, "docs", "demo.gif")).size,
};
await Bun.write(path.join(assets, "facts.json"), JSON.stringify(facts, null, 2) + "\n");
console.log("media:", JSON.stringify(facts));
