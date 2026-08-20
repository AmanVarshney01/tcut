import { describe, expect, test } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { buildSvg } from "../src/export/svg";
import { shiftSequence, wheelSequence } from "../src/keys";
import { fitFrame, loopOffsetFrames, rotateFrames } from "../src/loop";
import { record } from "../src/recorder";
import { render } from "../src/renderer/webview";
import type { Recording } from "../src/types";

const dir = "/tmp/tcut-parity-test";
const cast: Recording = {
  header: { version: 2, width: 40, height: 10 },
  events: [
    [0.0, "o", "> one\r\n"],
    [0.3, "o", "> two\r\n"],
    [0.6, "m", "end"],
  ],
};

describe("pixel sizing", () => {
  test("cols/rows are derived from width/height and font metrics", () => {
    const c = resolveConfig({ output: "x.mp4", width: 1280, height: 720, padding: 20, margin: 0 });
    // cell ≈ 12 × 24 at 20px: (1280-40)/12 = 103 cols, (720-40)/24 = 28 rows
    expect(c.cols).toBe(103);
    expect(c.rows).toBe(28);
    expect(c.width).toBe(1280);
    const explicit = resolveConfig({ output: "x.mp4", width: 1280, cols: 60 });
    expect(explicit.cols).toBe(60);
  });

  test("fitFrame centres the grid inside the requested size", () => {
    const f = fitFrame({ termW: 600, termH: 300, padding: 10, margin: 20, bar: 0, width: 1000, height: 500 });
    expect(f.width).toBe(1000);
    expect(f.height).toBe(500);
    expect(f.frameW).toBe(960);
    expect(f.padX).toBe(180);
    expect(f.padY).toBe(80);
    const tight = fitFrame({ termW: 600, termH: 300, padding: 10, margin: 0, bar: 36 });
    expect(tight).toMatchObject({ frameW: 620, frameH: 356, padX: 10, padY: 10, width: 620, height: 356 });
  });

  test("rendered PNG and SVG are exactly width × height", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const config = resolveConfig({ output: path.join(dir, "frames") + "/", width: 640, height: 360, fps: 5, cols: 40, rows: 10, windowBar: "colorful" });
    await render(cast, config);
    const first = (await readdir(path.join(dir, "frames"))).filter((f) => f.endsWith(".png")).sort()[0]!;
    const png = new Uint8Array(await Bun.file(path.join(dir, "frames", first)).arrayBuffer());
    const dv = new DataView(png.buffer, png.byteOffset);
    expect([dv.getUint32(16), dv.getUint32(20)]).toEqual([640, 360]);
    const { svg } = await buildSvg(cast, config);
    expect(svg).toContain('width="640" height="360"');
  }, 60_000);
});

describe("shift and scroll", () => {
  test("sequences", () => {
    expect(shiftSequence("tab")).toBe("\x1b[Z");
    expect(shiftSequence("up")).toBe("\x1b[1;2A");
    expect(shiftSequence("a")).toBe("A");
    expect(() => shiftSequence("f1")).toThrow();
    expect(wheelSequence("up", 3, 4)).toBe("\x1b[<64;3;4M");
    expect(wheelSequence("down", 1, 1)).toBe("\x1b[<65;1;1M");
  });

  test("scroll is skipped at a plain prompt, shift+tab is sent", async () => {
    const logs: string[] = [];
    const rec = await record(
      resolveConfig({ output: "/tmp/tcut-parity-test/x.mp4", endPause: 0, typingSpeed: 0 }),
      async (t) => {
        await t.scrollDown(3);
        await t.shift("tab");
        await t.ctrl("c");
      },
      { log: (m) => logs.push(m) },
    );
    const inputs = rec.events.filter((e) => e[1] === "i").map((e) => e[2]).join("");
    expect(inputs).not.toContain("\x1b[<65");
    expect(inputs).toContain("\x1b[Z");
    expect(logs.some((l) => /mouse tracking/.test(l))).toBe(true);
  });
});

describe("loop offset", () => {
  test("frame math", () => {
    expect(loopOffsetFrames(100, "50%")).toBe(50);
    expect(loopOffsetFrames(100, 30)).toBe(30);
    expect(loopOffsetFrames(100, 130)).toBe(30);
    expect(loopOffsetFrames(100, undefined)).toBe(0);
    expect(() => loopOffsetFrames(100, "half")).toThrow();
    expect(rotateFrames([0, 1, 2, 3, 4], 2)).toEqual([2, 3, 4, 0, 1]);
    expect(rotateFrames([0, 1, 2], 0)).toEqual([0, 1, 2]);
  });

  test("gif with loopOffset still encodes", async () => {
    await mkdir(dir, { recursive: true });
    const out = path.join(dir, "loop.gif");
    const config = resolveConfig({ output: [out, path.join(dir, "loop.mp4")], fps: 5, loopOffset: "50%" });
    const result = await render(cast, config);
    expect(result.frames).toBe(4);
    expect(Bun.file(out).size).toBeGreaterThan(0);
    expect(Bun.file(path.join(dir, "loop.mp4")).size).toBeGreaterThan(0);
  }, 60_000);
});
