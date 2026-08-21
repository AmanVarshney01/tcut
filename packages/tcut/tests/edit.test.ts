import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { chapterRanges, concatRecordings, cutRecording, flattenRecording, recordingDuration, selectChapters } from "../src/edit";
import { buildSvg } from "../src/export/svg";
import { renderOutputs } from "../src/render";
import { decodePng, encodePng, matte, type RgbaImage } from "../src/renderer/png";
import { buildTimeline } from "../src/timeline";
import type { Recording } from "../src/types";

const dir = "/tmp/tcut-edit-test";

const rec = (events: Recording["events"], cols = 40, rows = 10): Recording => ({ header: { version: 2, width: cols, height: rows }, events });
const base = resolveConfig({ output: "x.svg", cols: 40, rows: 10 });

describe("timelapse segments", () => {
  test("speed markers compress the events that follow", () => {
    const t = buildTimeline(
      [
        [0, "o", "a"],
        [1, "m", "speed:4"],
        [3, "o", "b"],
        [3, "m", "speed:1"],
        [4, "o", "c"],
        [4, "m", "end"],
      ],
      1,
    );
    expect(t.events.map((e) => e.vt)).toEqual([0, 1.5, 2.5, 2.5]);
    expect(t.duration).toBe(2.5);
    expect(t.events.some((e) => e.data.startsWith("speed:"))).toBe(false);
  });
  test("nests with hide and global speed", () => {
    const t = buildTimeline(
      [
        [0, "o", "a"],
        [1, "m", "hide"],
        [2, "o", "hidden"],
        [3, "m", "show"],
        [3, "m", "speed:2"],
        [5, "o", "b"],
      ],
      2,
    );
    // a@0; hidden@0.5 (hide started at 1 → 1/2); b: (5-2 removed) = 3 collapsed → (3-1)/(2*2) after 1/2 = 1
    expect(t.events.map((e) => [e.data, e.vt])).toEqual([
      ["a", 0],
      ["hidden", 0.5],
      ["b", 1],
    ]);
  });
});

describe("cut", () => {
  const cast = rec([
    [0, "o", "one"],
    [0.5, "o", "two"],
    [1.5, "o", "three"],
    [2.5, "o", "four"],
    [3, "m", "end"],
  ]);
  test("keeps state from before the window at t=0 and re-times the rest", () => {
    const out = cutRecording(cast, base, { from: 1, to: 2 });
    expect(out.events).toEqual([
      [0, "o", "one"],
      [0, "o", "two"],
      [0.5, "o", "three"],
      [1, "m", "end"],
    ]);
    expect(out.header.duration).toBe(1);
    expect(out.header.bunVideo?.playbackSpeed).toBe(1);
    expect(recordingDuration(out)).toBe(1);
  });
  test("works on the visible timeline (playback speed applied first)", () => {
    const out = cutRecording(cast, { ...base, playbackSpeed: 2 }, { from: 0.5, to: 1 });
    expect(out.events).toEqual([
      [0, "o", "one"],
      [0, "o", "two"],
      [0.25, "o", "three"],
      [0.5, "m", "end"],
    ]);
  });
  test("keeps the last zoom before the window and drops earlier chapters", () => {
    const out = cutRecording(
      rec([
        [0, "m", "chapter:Intro"],
        [0.2, "m", 'zoom:{"rows":[0,2]}'],
        [0.4, "m", "zoom:null"],
        [1, "o", "x"],
        [2, "m", "end"],
      ]),
      base,
      { from: 1 },
    );
    expect(out.events).toEqual([
      [0, "m", "zoom:null"],
      [0, "o", "x"],
      [1, "m", "end"],
    ]);
  });
  test("rejects an empty window", () => {
    expect(() => cutRecording(cast, base, { from: 2, to: 1 })).toThrow(/Nothing to keep/);
    expect(() => cutRecording(cast, base, { from: 5 })).toThrow();
  });
  test("flatten is idempotent with respect to rendering config", () => {
    const flat = flattenRecording(cast, { ...base, playbackSpeed: 2, maxPause: 0.4 });
    expect(flat.events.map((e) => e[0])).toEqual([0, 0.25, 0.65, 1.05, 1.3]);
    const again = flattenRecording(flat, flat.header.bunVideo!);
    expect(again.events).toEqual(flat.events);
  });
});

describe("concat", () => {
  const a = rec([
    [0, "o", "A1"],
    [1, "m", "end"],
  ]);
  const b = rec([
    [0, "o", "B1"],
    [0.5, "m", "chapter:Two"],
    [1, "m", "end"],
  ]);
  test("joins with a reset at the seam and keeps chapters", () => {
    const out = concatRecordings(
      [
        { rec: a, config: base },
        { rec: b, config: base },
      ],
      { gap: 0.5 },
    );
    expect(out.events).toEqual([
      [0, "o", "A1"],
      [1.5, "o", "\x1bc"],
      [1.5, "m", "zoom:null"],
      [1.5, "o", "B1"],
      [2, "m", "chapter:Two"],
      [2.5, "m", "end"],
    ]);
    expect(out.header.duration).toBe(2.5);
  });
  test("refuses different grid sizes", () => {
    expect(() => concatRecordings([{ rec: a, config: base }, { rec: rec([[0, "o", "x"]], 80, 24), config: base }])).toThrow(/same size/);
  });
});

describe("chapters", () => {
  const cast = rec([
    [0, "m", "chapter:Intro"],
    [0.1, "o", "hello"],
    [1, "m", "chapter:Zoom in"],
    [1.2, "o", "zoomed"],
    [2, "m", "end"],
  ]);
  test("ranges run to the next chapter", () => {
    expect(chapterRanges(cast, base)).toEqual([
      { title: "Intro", from: 0, to: 1 },
      { title: "Zoom in", from: 1, to: 2 },
    ]);
  });
  test("select by loose title or number, in the order given", () => {
    const zoom = selectChapters(cast, base, ["zoom-in"]);
    expect(recordingDuration(zoom)).toBe(1);
    expect(zoom.events.some((e) => e[2] === "zoomed")).toBe(true);
    const reversed = selectChapters(cast, base, ["2", "Intro"]);
    expect(recordingDuration(reversed)).toBe(2);
    expect(reversed.events.findIndex((e) => e[2] === "zoomed")).toBeLessThan(reversed.events.findIndex((e) => e[2] === "chapter:Intro"));
    expect(() => selectChapters(cast, base, ["nope"])).toThrow(/Unknown chapter "nope"\. Chapters: 1\. Intro, 2\. Zoom in/);
  });
});

describe("png codec", () => {
  test("round-trips RGBA", () => {
    const img: RgbaImage = { width: 3, height: 2, data: new Uint8Array(24).map((_, i) => (i * 37) & 0xff) };
    const back = decodePng(encodePng(img));
    expect(back.width).toBe(3);
    expect(back.height).toBe(2);
    expect([...back.data]).toEqual([...img.data]);
  });
  test("two-background matting recovers alpha and colour", () => {
    // pixel 0: 50% red over black/white · pixel 1: fully transparent · pixel 2: opaque (10,20,30)
    const onBlack: RgbaImage = { width: 3, height: 1, data: new Uint8Array([128, 0, 0, 255, 0, 0, 0, 255, 10, 20, 30, 255]) };
    const onWhite: RgbaImage = { width: 3, height: 1, data: new Uint8Array([255, 128, 128, 255, 255, 255, 255, 255, 10, 20, 30, 255]) };
    const m = matte(onBlack, onWhite, [0, 0, 0], [255, 255, 255]);
    const px = (i: number) => [...m.data.subarray(i * 4, i * 4 + 4)];
    const [r, g, b, a] = px(0);
    expect(Math.abs(a! - 128)).toBeLessThanOrEqual(2);
    expect(r).toBeGreaterThanOrEqual(250);
    expect(g).toBeLessThanOrEqual(3);
    expect(b).toBeLessThanOrEqual(3);
    expect(px(1)[3]).toBe(0);
    expect(px(2)).toEqual([10, 20, 30, 255]);
  });
});

describe("looks config", () => {
  test("shadow gives the window room; watermark shorthand is text bottom-right", () => {
    const c = resolveConfig({ output: "x.mp4", shadow: true, watermark: "© me" });
    expect(c.margin).toBe(40);
    expect(c.shadow).toEqual({ x: 0, y: 18, blur: 50, color: "#000000", opacity: 0.45 });
    expect(c.watermark).toMatchObject({ text: "© me", position: "bottom-right", opacity: 0.6, size: 14, margin: 16 });
    expect(resolveConfig({ output: "x.mp4", shadow: { blur: 10 }, margin: 8 }).margin).toBe(8);
    expect(() => resolveConfig({ output: "x.mp4", watermark: {} })).toThrow(/text.*image/);
  });
});

describe("svg / txt output", () => {
  const cast = rec([
    [0, "o", "> one\r\n"],
    [0.3, "o", "> two\r\n"],
    [0.6, "m", "end"],
  ]);
  test("svg carries shadow, watermark and transparency", async () => {
    const { svg } = await buildSvg(cast, resolveConfig({ output: "x.svg", cols: 40, rows: 10, shadow: true, watermark: "© me", marginFill: "transparent" }));
    expect(svg).toContain('<filter id="shadow"');
    expect(svg).toContain('filter="url(#shadow)"');
    expect(svg).toContain(">© me</text>");
    expect(svg).not.toContain('<rect width="100%"');
    const plain = await buildSvg(cast, resolveConfig({ output: "x.svg", cols: 40, rows: 10 }));
    expect(plain.svg).toContain('<rect width="100%"');
    expect(plain.svg).not.toContain("shadow");
  });
  test(".txt is the final screen as text", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, "screen.txt");
    const r = await renderOutputs(cast, resolveConfig({ output: file, cols: 40, rows: 10 }));
    expect(r.outputs).toEqual([file]);
    expect(await Bun.file(file).text()).toBe("> one\n> two\n");
  });
});

describe("transparent raster output", () => {
  test("png has alpha in the margin, a soft shadow, and an opaque window", async () => {
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, "alpha.png");
    const cast = rec(
      [
        [0, "o", "hi"],
        [0.4, "m", "end"],
      ],
      20,
      4,
    );
    const config = resolveConfig({ output: file, cols: 20, rows: 4, fps: 5, margin: 30, marginFill: "transparent", shadow: { y: 10, blur: 20 } });
    const r = await renderOutputs(cast, config);
    expect(r.outputs).toEqual([file]);
    const img = decodePng(new Uint8Array(await Bun.file(file).arrayBuffer()));
    const alphaAt = (x: number, y: number) => img.data[(y * img.width + x) * 4 + 3]!;
    expect(alphaAt(2, 2)).toBe(0); // corner of the margin: nothing drawn
    expect(alphaAt(Math.floor(img.width / 2), Math.floor(img.height / 2))).toBe(255); // inside the window
    const belowWindow = alphaAt(Math.floor(img.width / 2), img.height - 12); // shadow falls here
    expect(belowWindow).toBeGreaterThan(0);
    expect(belowWindow).toBeLessThan(255);
  }, 30_000);
});
