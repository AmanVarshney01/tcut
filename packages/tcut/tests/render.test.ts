import { describe, expect, test } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { hasEncoder } from "../src/renderer/encoder";
import { render } from "../src/renderer/webview";
import { renderOutputs } from "../src/render";
import type { Recording } from "../src/types";

const dir = "/tmp/tcut-render-test";

const cast: Recording = {
  header: { version: 2, width: 20, height: 5 },
  events: [
    [0.0, "o", "> \x1b[31mred\x1b[0m \x1b[42m bg \x1b[0m\r\n"],
    [0.1, "r", "30x8"],
    [0.2, "o", "after resize 日本 🚀\r\n> "],
    [0.3, "m", "screenshot:" + path.join(dir, "shot.png")],
    [0.4, "m", "end"],
  ],
};

const pngSize = (buf: Uint8Array) => {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
};

async function probe(file: string): Promise<string> {
  if (!Bun.which("ffprobe")) return "skipped";
  const p = Bun.spawn(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=codec_name,width,height", "-of", "csv=p=0", file], { stdout: "pipe" });
  return (await new Response(p.stdout).text()).trim();
}

describe("renderer", () => {
  test("all encoders from one pass, fixed frame size across resize, screenshot marker", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const exts = ["mp4", "webm", "gif"];
    if (await hasEncoder("libwebp_anim", "libwebp")) exts.push("webp");
    const outputs = exts.map((ext) => path.join(dir, `out.${ext}`));
    const videoCount = outputs.length;
    outputs.push(path.join(dir, "frames") + "/");
    const config = resolveConfig({ output: outputs, fps: 10, padding: 8, margin: 4, borderRadius: 6, windowBar: "colorful", title: "t" });

    const result = await render(cast, config);
    expect(result.frames).toBe(5);
    expect(result.screenshots).toEqual([path.join(dir, "shot.png")]);

    for (const out of outputs.slice(0, videoCount)) {
      expect(Bun.file(out).size).toBeGreaterThan(0);
    }
    expect(await probe(path.join(dir, "out.mp4"))).toMatch(/^(h264,\d+,\d+|skipped)$/);
    expect(await probe(path.join(dir, "out.webm"))).toMatch(/^(vp9,\d+,\d+|skipped)$/);

    const frames = (await readdir(path.join(dir, "frames"))).filter((f) => f.endsWith(".png")).sort();
    expect(frames).toHaveLength(5);
    const sizes = await Promise.all(frames.map(async (f) => pngSize(new Uint8Array(await Bun.file(path.join(dir, "frames", f)).arrayBuffer()))));
    expect(new Set(sizes.map((s) => `${s.w}x${s.h}`)).size).toBe(1);
    expect(sizes[0]!.w % 2).toBe(0);
    expect(sizes[0]!.h % 2).toBe(0);
    expect(Bun.file(path.join(dir, "shot.png")).size).toBeGreaterThan(0);
  }, 60_000);

  test("lite core renders", async () => {
    const out = path.join(dir, "lite") + "/";
    const config = resolveConfig({ output: out, fps: 10, core: "lite" });
    const result = await render(cast, config);
    expect(result.frames).toBe(5);
    const frames = (await readdir(path.join(dir, "lite"))).filter((f) => f.endsWith(".png"));
    expect(frames).toHaveLength(5);
  }, 60_000);
});

describe("bundled symbols font", () => {
  test("ships with the renderer assets and loads in the render page", async () => {
    const { pageAssets } = await import("../src/renderer/bundle");
    const assets = await pageAssets();
    expect(Bun.file(assets.symbolsFontPath).size).toBeGreaterThan(2_000_000);
    const { renderHtml } = await import("../src/renderer/page");
    expect(renderHtml(resolveConfig({ output: "x.mp4" }))).toContain('font-family: "Symbols Nerd Font Mono"; src: url("/fonts/symbols.ttf")');
    // a prompt with a powerline separator and a Nerd icon: the render must not report the font missing
    const d = path.join(dir, "symbols");
    await rm(d, { recursive: true, force: true });
    await mkdir(d, { recursive: true });
    const rec: Recording = {
      header: { version: 2, width: 30, height: 4 },
      events: [
        [0.0, "o", "\uf0035 aman \ue0b0 ~ \ue0b0\r\n> "],
        [0.3, "m", "end"],
      ],
    };
    const result = await render(rec, resolveConfig({ output: [path.join(d, "out.png")], fps: 10 }));
    expect(result.notes ?? []).not.toContainEqual(expect.stringContaining("Nerd Font symbols"));
    expect(Bun.file(path.join(d, "out.png")).size).toBeGreaterThan(0);
  }, 30_000);
});

describe("raster snapshots", () => {
  test("a png snapshot renders even when no raster output is configured", async () => {
    const d = path.join(dir, "snap-only");
    await rm(d, { recursive: true, force: true });
    await mkdir(d, { recursive: true });
    const shot = path.join(d, "only.png");
    const rec: Recording = {
      header: { version: 2, width: 20, height: 5 },
      events: [
        [0.0, "o", "hello still\r\n> "],
        [0.2, "m", "screenshot:" + shot],
        [0.3, "m", "end"],
      ],
    };
    const config = resolveConfig({ output: [path.join(d, "out.txt")], fps: 10 });
    const result = await renderOutputs(rec, config);
    expect(result.outputs).toEqual([path.join(d, "out.txt")]);
    expect(result.screenshots).toEqual([shot]);
    expect(Bun.file(shot).size).toBeGreaterThan(0);
  }, 30_000);
});
