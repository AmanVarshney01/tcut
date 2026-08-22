import { describe, expect, test } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { buildSvg } from "../src/export/svg";
import { decodePng } from "../src/renderer/png";
import { render } from "../src/renderer/webview";
import type { Recording } from "../src/types";

const dir = "/tmp/tcut-glyph-pin-test";

// A progress bar of fallback-font glyphs changes shape; the text after it must not move.
const cast: Recording = {
  header: { version: 2, width: 40, height: 2 },
  events: [
    [0.0, "o", "\x1b[?25l■■⬝⬝⬝⬝  esc interrupt        v1.0\r\nplain ascii row"],
    [0.2, "o", "\x1b[H\x1b[2K⬝⬝⬝⬝■■  esc interrupt        v1.0\r\n"],
    [0.4, "m", "end"],
  ],
};

describe("glyph pinning", () => {
  test("raster: swapping fallback-font glyphs does not shift the rest of the row", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const frames = path.join(dir, "frames") + "/";
    const config = resolveConfig({ output: [frames], fps: 5, padding: 0, margin: 0, windowBar: "none", cols: 40, rows: 2 });
    await render(cast, config);
    const files = (await readdir(path.join(dir, "frames"))).filter((f) => f.endsWith(".png")).sort();
    expect(files.length).toBeGreaterThanOrEqual(2);
    const first = decodePng(new Uint8Array(await Bun.file(path.join(dir, "frames", files[0]!)).arrayBuffer()));
    const last = decodePng(new Uint8Array(await Bun.file(path.join(dir, "frames", files[files.length - 1]!)).arrayBuffer()));
    expect(last.width).toBe(first.width);
    // Compare everything right of the bar (from column 10 of 40): identical pixels, even though the bar itself changed.
    const cellW = first.width / 40;
    const from = Math.ceil(cellW * 10) * 4;
    const rowBytes = first.width * 4;
    let diff = 0;
    let total = 0;
    for (let y = 0; y < first.height; y++) {
      for (let i = from; i < rowBytes; i += 4) {
        const o = y * rowBytes + i;
        total++;
        if (first.data[o] !== last.data[o] || first.data[o + 1] !== last.data[o + 1] || first.data[o + 2] !== last.data[o + 2]) diff++;
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(diff).toBe(0);
    // sanity: the bar region did change, so the frames are not simply identical
    let barDiff = 0;
    for (let y = 0; y < first.height; y++) for (let i = 0; i < from; i += 4) {
      const o = y * rowBytes + i;
      if (first.data[o] !== last.data[o] || first.data[o + 1] !== last.data[o + 1] || first.data[o + 2] !== last.data[o + 2]) barDiff++;
    }
    expect(barDiff).toBeGreaterThan(0);
  }, 60_000);

  test("svg: runs with non-ASCII glyphs position every glyph on its own cell", async () => {
    const config = resolveConfig({ output: ["x.svg"], fps: 5, cols: 40, rows: 2 });
    const { svg } = await buildSvg(cast, config);
    // the row with the bar carries an x list (one value per glyph); a plain ASCII row keeps a single x
    const pinned = svg.match(/<tspan x="([^"]+)"[^>]*>■■⬝⬝⬝⬝/);
    expect(pinned).not.toBeNull();
    const xs = pinned![1]!.split(" ");
    expect(xs.length).toBeGreaterThanOrEqual(6); // one x per glyph of the run
    const plain = svg.match(/<tspan x="([^"]+)"[^>]*>plain ascii row/);
    expect(plain).not.toBeNull();
    expect(plain![1]!.split(" ").length).toBe(1);
  });
});
