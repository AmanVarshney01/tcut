import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { replayFrames, resolveColor } from "../src/export/frames";
import { buildHtml } from "../src/export/html";
import { buildSvg, svgGeometry } from "../src/export/svg";
import { renderOutputs } from "../src/render";
import { builtinThemes as themes } from "../src/themes";
import type { Recording } from "../src/types";

const dir = "/tmp/tcut-export-test";

const cast: Recording = {
  header: { version: 2, width: 20, height: 4 },
  events: [
    [0.0, "o", "> \x1b[31mred\x1b[0m \x1b[1mbold\x1b[0m\r\n"],
    [0.5, "o", "\x1b[42m bg \x1b[0m 日本\r\n> "],
    [5.5, "m", "end"], // 5 s idle → one held frame
  ],
};

describe("frames", () => {
  test("resolveColor handles palette, default, 256 and rgb", () => {
    const t = themes["dracula"];
    expect(resolveColor(1, undefined, t)).toBe(t.red);
    expect(resolveColor(256, undefined, t)).toBeNull();
    expect(resolveColor(196, undefined, t)).toBe("#ff0000");
    expect(resolveColor(232, undefined, t)).toBe("#080808");
    expect(resolveColor(256, 0x123456, t)).toBe("#123456");
  });

  test("replay dedupes identical grids and applies the theme via OSC 4", async () => {
    const config = resolveConfig({ output: "x.svg", fps: 10, theme: "catppuccin-mocha" });
    const replay = await replayFrames(cast, config);
    expect(replay.frames.length).toBe(2);
    expect(replay.frames[1]!.hold).toBeCloseTo(5.1, 1);
    const row0 = replay.frames[0]!.rows_.get(0)!;
    const red = row0.find((c) => c.text === "r")!;
    expect(red.fg).toBe(themes["catppuccin-mocha"].red);
    const bold = row0.find((c) => c.text === "b")!;
    expect(bold.flags & 0x01).toBe(0x01);
    const row1 = replay.frames[1]!.rows_.get(1)!;
    const wide = row1.find((c) => c.text === "日")!;
    expect(wide.width).toBe(2);
  });
});

describe("svg export", () => {
  test("emits a looping stepped animation with one group per unique frame", async () => {
    const config = resolveConfig({ output: "x.svg", fps: 10, padding: 10, margin: 5, windowBar: "colorful", title: "svg" });
    const { svg, frames, duration } = await buildSvg(cast, config);
    expect(frames).toBe(2);
    expect(duration).toBeCloseTo(5.6, 1);
    expect(svg.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns=')).toBe(true);
    expect(svg).toContain("steps(1,end) infinite");
    expect(svg).toContain("@keyframes tcut{0%{transform:translateX(0px)}");
    expect(svg.match(/<g transform="translate\(\d+(\.\d+)? 0\)">/g)).toHaveLength(2);
    expect(svg).toContain(`fill="${themes["catppuccin-mocha"].red}"`);
    expect(svg).toContain('font-weight="bold"');
    expect(svg).toContain("日本");
    const g = svgGeometry(config, 20, 4);
    expect(svg).toContain(`width="${g.width}" height="${g.height}"`);
    expect(g.termX).toBe(15);
  });
});

describe("html export", () => {
  test("is self-contained and embeds the events", async () => {
    const config = resolveConfig({ output: "x.html", title: "player" });
    const html = await buildHtml(cast, config);
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).toContain('id="tcut-cast"');
    expect(html).toContain("日本");
    expect(html).toContain("AGFzbQ"); // inline WASM (base64 of "\0asm")
    expect(html.length).toBeGreaterThan(20_000);
  });
});

describe("renderOutputs dispatcher", () => {
  test("svg/html need no WebView; stills come from the last raster frame", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const outputs = ["out.svg", "out.html", "last.png", "last.jpg"].map((f) => path.join(dir, f));
    const config = resolveConfig({ output: outputs, fps: 5 });
    const result = await renderOutputs(cast, config);
    expect(result.outputs.sort()).toEqual(outputs.sort());
    for (const out of outputs) expect(Bun.file(out).size).toBeGreaterThan(0);
    const png = new Uint8Array(await Bun.file(path.join(dir, "last.png")).arrayBuffer());
    expect(Array.from(png.slice(1, 4), (b) => String.fromCharCode(b)).join("")).toBe("PNG");
    const jpg = new Uint8Array(await Bun.file(path.join(dir, "last.jpg")).arrayBuffer());
    expect(jpg[0]).toBe(0xff);
    expect(jpg[1]).toBe(0xd8);
  }, 60_000);
});
