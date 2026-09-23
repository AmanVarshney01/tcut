import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { toMs } from "../src/duration";
import { diffCasts } from "../src/diff";
import { writeCast } from "../src/cast";
import { defineVideo } from "../src/video";
import { record } from "../src/recorder";
import { concatRecordings, flattenRecording } from "../src/edit";
import { replayFrames, resolveColor } from "../src/export/frames";
import { buildHtml } from "../src/export/html";
import { renderOutputs } from "../src/render";
import { buildTimeline } from "../src/timeline";
import { themes } from "../src/themes";
import type { Recording } from "../src/types";

const recording: Recording = {
  header: { version: 2, width: 20, height: 4 },
  events: [[0, "o", "first"], [5, "o", "\rsecond"], [10, "m", "end"]],
};

describe("render timing regressions", () => {
  test("grid and HTML exports apply the same idle compression as raster output", async () => {
    const config = resolveConfig({ output: "x.svg", fps: 10, maxPause: "500ms" });
    const grid = await replayFrames(recording, config);
    expect(grid.duration).toBeCloseTo(1.1);
    expect(grid.frames[1]!.time).toBe(0.5);
    const html = await buildHtml(recording, config);
    expect(html).toContain('"duration":1,');
    expect(html).toContain('"vt":0.5,"type":"o"');
  });

  test("input overlay does not change the compressed timeline", () => {
    const events: Recording["events"] = [[0, "o", "a"], [1, "i", "x"], [2, "o", "b"], [3, "m", "end"]];
    const withKeys = buildTimeline(events, 1, { keepInput: true, maxPause: 0.5 });
    const without = buildTimeline(events, 1, { maxPause: 0.5 });
    expect(without.events).toEqual(withKeys.events.filter((e) => e.type !== "i"));
    expect(without.duration).toBe(withKeys.duration);
  });

  test("joining flattened recordings preserves the requested gap", () => {
    const config = resolveConfig({ output: "x.svg", maxPause: "500ms" });
    const joined = concatRecordings([{ rec: recording, config }, { rec: recording, config }], { gap: 2 });
    expect(joined.header.duration).toBe(4);
    expect(flattenRecording(joined, joined.header.bunVideo!).header.duration).toBe(4);
  });

  test("SVG snapshots and HTML-only results use the visible clock", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "tcut-timing-"));
    try {
      const still = path.join(dir, "still.svg");
      const rec: Recording = { ...recording, events: [[0, "o", "first"], [5, "m", `screenshot:${still}`], [10, "o", "\rsecond"], [15, "m", "end"]] };
      const result = await renderOutputs(rec, resolveConfig({ output: path.join(dir, "out.html"), fps: 10, maxPause: "500ms" }));
      expect(result.durationSeconds).toBeGreaterThan(0);
      const svg = await Bun.file(still).text();
      expect(svg).toContain("first");
      expect(svg).not.toContain("second");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

test("ANSI color cube uses xterm's uneven intensity levels", () => {
  expect(resolveColor(17, undefined, themes.dracula)).toBe("#00005f");
  expect(resolveColor(67, undefined, themes.dracula)).toBe("#5f87af");
  expect(resolveColor(255, undefined, themes.dracula)).toBe("#eeeeee");
});

test("duration rejects overflow and supports small numeric durations", () => {
  expect(() => toMs(`${"9".repeat(310)}m`)).toThrow(/duration/i);
  expect(toMs(0.0000001)).toBe(0.0000001);
});

test("invalid render dimensions and speeds fail before rendering", () => {
  for (const fps of [0, -1, Infinity, NaN]) expect(() => resolveConfig({ output: "x.svg", fps })).toThrow(/fps/);
  for (const playbackSpeed of [0, -1, Infinity, NaN]) expect(() => resolveConfig({ output: "x.svg", playbackSpeed })).toThrow(/playbackSpeed/);
  for (const cols of [0, -1, 1.5, Infinity]) expect(() => resolveConfig({ output: "x.svg", cols })).toThrow(/cols/);
});

test("diff images show the compared instant, including the first frame", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tcut-diff-at-"));
  try {
    const a = path.join(dir, "a.cast");
    const b = path.join(dir, "b.cast");
    const config = resolveConfig({ output: "x.png", fps: 10, playbackSpeed: 2, cursor: { blink: false } });
    const header = { ...recording.header, bunVideo: config };
    await writeCast(a, { header, events: [[0, "o", "same"], [0.4, "o", "\r\x1b[Kdifferent"], [0.8, "m", "end"]] });
    await writeCast(b, { header, events: [[0, "o", "same"], [0.8, "m", "end"]] });
    const early = await diffCasts(a, b, { at: 0, images: path.join(dir, "early") });
    expect(early.equal).toBe(true);
    expect(await Bun.file(early.images!.a).arrayBuffer()).toEqual(await Bun.file(early.images!.b).arrayBuffer());
    const late = await diffCasts(a, b, { at: 0.3, images: path.join(dir, "late") });
    expect(late.equal).toBe(false);
    expect(await Bun.file(late.images!.a).arrayBuffer()).not.toEqual(await Bun.file(late.images!.b).arrayBuffer());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30_000);

test("screen assertions can reuse global and sticky regular expressions", async () => {
  await record(resolveConfig({ output: "x.cast", typingSpeed: 0, endPause: 0 }), async (t) => {
    await t.run("echo reusable");
    const pattern = /reusable/g;
    await t.expect(pattern);
    await t.expect(pattern);
    expect(pattern.lastIndex).toBe(0);
  }, { fast: true });
});

test("record cache includes browser settings", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tcut-browser-cache-"));
  try {
    const source = path.join(dir, "demo.video.ts");
    await Bun.write(source, "export default 1;\n");
    const video = defineVideo({ output: "x.mp4", browser: { url: "https://example.com" } }, async () => {});
    video.source = source;
    const initial = await video.scriptHash();
    video.config.browser!.url = "https://example.org";
    expect(await video.scriptHash()).not.toBe(initial);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("raster duration matches the encoded frames, including the final tick", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "tcut-duration-"));
  try {
    const file = path.join(dir, "out.mp4");
    const result = await renderOutputs(recording, resolveConfig({ output: file, fps: 10, maxPause: "500ms" }));
    expect(result.durationSeconds).toBe(1.1);
    const probe = Bun.spawn(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file], { stdout: "pipe", stderr: "pipe" });
    expect(Number(await new Response(probe.stdout).text())).toBeCloseTo(result.durationSeconds);
    expect(await probe.exited).toBe(0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30_000);
