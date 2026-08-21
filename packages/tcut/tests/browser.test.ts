import { describe, expect, test } from "bun:test";
import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { parseCast, readCast, writeCast } from "../src/cast";
import { resolveConfig } from "../src/config";
import { record } from "../src/recorder";
import { render } from "../src/renderer/webview";
import { buildTimeline } from "../src/timeline";
import type { Recording } from "../src/types";
import { attachBrowserFrames } from "../src/video";

const dir = "/tmp/tcut-browser-test";
const pngSize = (buf: Uint8Array) => {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  return { w: dv.getUint32(16), h: dv.getUint32(20) };
};

describe("browser pane", () => {
  test("records a WebView beside the terminal and persists frames as b events", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const server = Bun.serve({
      port: 0,
      fetch: () => new Response("<html><body style='background:#fff;font:40px sans-serif'><h1 id=t>first</h1><button onclick=\"t.textContent='clicked'\">go</button></body></html>", { headers: { "content-type": "text/html" } }),
    });
    try {
      const url = `http://127.0.0.1:${server.port}/`;
      const config = resolveConfig({ output: `${dir}/x.mp4`, cols: 40, rows: 10, endPause: 0, typingSpeed: 0, browser: { url, width: 320, height: 240, fps: 20 } });
      const rec = await record(config, async (t) => {
        await t.browser.waitFor(/first/);
        await t.run("echo terminal-side");
        await t.browser.click("button");
        await t.browser.waitFor(/clicked/);
        await t.focus("browser");
        await t.sleep(200);
        await t.focus("terminal");
      });
      expect(rec.browserFrames?.length).toBeGreaterThanOrEqual(2); // blank → first → clicked (deduped)
      expect(rec.events.filter((e) => e[1] === "m" && e[2].startsWith("focus:")).map((e) => e[2])).toEqual(["focus:browser", "focus:terminal"]);

      const castPath = path.join(dir, "demo.cast");
      await attachBrowserFrames(rec, castPath);
      await writeCast(castPath, rec);
      const files = await readdir(path.join(dir, "demo.browser"));
      expect(files.length).toBe(rec.events.filter((e) => e[1] === "b").length);
      expect(rec.browserFrames).toBeUndefined();
      const times = rec.events.map((e) => e[0]);
      expect([...times].sort((a, b) => a - b)).toEqual(times); // merged in order

      const reread = await readCast(castPath);
      expect(reread.source).toBe(path.resolve(castPath));
      expect(reread.events.some((e) => e[1] === "b" && e[2].startsWith("demo.browser/"))).toBe(true);
    } finally {
      server.stop(true);
    }
  }, 60_000);

  test("b and focus events survive the timeline and asciicast round trip", () => {
    const rec: Recording = {
      header: { version: 2, width: 10, height: 2 },
      events: [
        [0, "o", "hi"],
        [0.5, "b", "x.browser/0000.png"],
        [1, "m", "hide"],
        [1.5, "b", "x.browser/0001.png"],
        [2, "m", "show"],
        [2.5, "m", "focus:browser"],
      ],
    };
    const { events } = buildTimeline(rec.events, 1);
    expect(events.map((e) => [e.vt, e.type])).toEqual([
      [0, "o"],
      [0.5, "b"],
      [1, "b"], // hidden frame lands on the hide instant
      [1.5, "m"],
    ]);
    const text = `{"version":2,"width":10,"height":2}\n[0.5,"b","x.browser/0000.png"]\n[0.6,"x","ignored"]\n`;
    expect(parseCast(text).events).toEqual([[0.5, "b", "x.browser/0000.png"]]);
  });

  test("renders composite layouts: right widens, bottom heightens, overlay keeps the pane size", async () => {
    await mkdir(path.join(dir, "f.browser"), { recursive: true });
    // Any PNG works as a browser frame; borrow the repo's demo still.
    const png = await Bun.file(path.join(import.meta.dir, "..", "docs", "demo.png")).arrayBuffer();
    await Bun.write(path.join(dir, "f.browser", "0000.png"), png);
    const base: Recording = {
      header: { version: 2, width: 20, height: 5 },
      events: [
        [0, "o", "> hello\r\n> "],
        [0.1, "b", "f.browser/0000.png"],
        [0.2, "m", "focus:browser"],
        [0.4, "m", "end"],
      ],
      source: path.join(dir, "f.cast"),
    };
    const sizes: Record<string, { w: number; h: number }> = {};
    for (const position of ["right", "bottom", "overlay", "none"] as const) {
      const out = path.join(dir, `frames-${position}`) + "/";
      const config = resolveConfig({
        output: out,
        fps: 10,
        padding: 8,
        margin: 4,
        ...(position !== "none" && { browser: { width: 300, height: 200, position, offset: { x: 20, y: 10 } } }),
      });
      await render(base, config);
      const first = (await readdir(path.join(dir, `frames-${position}`))).filter((f) => f.endsWith(".png")).sort()[0]!;
      sizes[position] = pngSize(new Uint8Array(await Bun.file(path.join(dir, `frames-${position}`, first)).arrayBuffer()));
    }
    expect(sizes.right!.w).toBe(sizes.none!.w + 16 + 300 + ((sizes.none!.w + 316) % 2));
    expect(sizes.right!.h).toBe(sizes.none!.h);
    expect(sizes.bottom!.w).toBe(sizes.none!.w);
    expect(sizes.bottom!.h).toBeGreaterThan(sizes.none!.h);
    // overlay: canvas = margin*2 + max(frame, offset + pane) in each axis
    expect(sizes.overlay!.w).toBeGreaterThanOrEqual(Math.max(sizes.none!.w, 4 * 2 + 20 + 300));
    expect(sizes.overlay!.h).toBe(Math.max(sizes.none!.h, 4 * 2 + 10 + 200) + (Math.max(sizes.none!.h, 228) % 2));
  }, 90_000);
});
