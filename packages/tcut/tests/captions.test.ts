import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { captionAt, captionsOnTimeline } from "../src/captions";
import { resolveConfig } from "../src/config";
import { concatRecordings, cutRecording, flattenRecording, flattenedConfig } from "../src/edit";
import { buildHtml } from "../src/export/html";
import { buildSvg, writeSvgSnapshots } from "../src/export/svg";
import { record } from "../src/recorder";
import { render } from "../src/renderer/webview";
import { buildTimeline } from "../src/timeline";
import type { CaptionSpec } from "../src/captions";
import type { CastEvent, Recording } from "../src/types";

const marker = (at: number, caption: CaptionSpec | null): CastEvent => [at, "m", `caption:${JSON.stringify(caption)}`];
const recording = (events: CastEvent[]): Recording => ({ header: { version: 2, width: 60, height: 12 }, events });
const cues = (events: CastEvent[]) => captionsOnTimeline(buildTimeline(events, 1).events);

describe("caption timing", () => {
  test("expiry and replacement do not clear a newer persistent caption", () => {
    const events: CastEvent[] = [marker(0, { text: "First", duration: 2000 }), marker(1, { text: "Second" }), [3, "m", "end"]];
    expect(captionAt(cues(events), 0.5)?.text).toBe("First");
    expect(captionAt(cues(events), 2.5)?.text).toBe("Second");
    expect(captionAt(cues([...events, marker(4, null)]), 4)).toBeNull();
    expect(captionAt(cues([marker(0, { text: "zero", duration: 0 }), [1, "m", "end"]]), 0)).toBeNull();
  });

  test("expiry follows hide and speed transforms; flattening is idempotent", () => {
    const rec = recording([marker(0, { text: "Hello", duration: 4000 }), [1, "m", "hide"], [2, "m", "show"], [2, "m", "speed:2"], [6, "m", "end"]]);
    const config = resolveConfig({ output: "x.svg", playbackSpeed: 2 });
    const timeline = buildTimeline(rec.events, 2);
    expect(captionsOnTimeline(timeline.events)[0]?.end).toBe(1);
    const flat = flattenRecording(rec, config);
    expect(flattenRecording(flat, flattenedConfig(config)).events).toEqual(flat.events);
  });

  test("expiry follows idle compression without extending the recording", () => {
    const events: CastEvent[] = [marker(0, { text: "Hello", duration: 4000 }), [10, "m", "end"]];
    const timeline = buildTimeline(events, 1, { maxPause: 1 });
    expect(captionsOnTimeline(timeline.events)[0]?.end).toBe(1);
    expect(timeline.duration).toBe(2);
    expect(buildTimeline([marker(0, { text: "Long", duration: 20_000 }), [1, "m", "end"]], 1).duration).toBe(1);
  });

  test("cuts retain the active caption and joins clear it at the seam", () => {
    const config = resolveConfig({ output: "x.svg" });
    const rec = recording([marker(0, { text: "First", duration: 4000 }), [6, "m", "end"]]);
    const cut = cutRecording(rec, config, { from: 2, to: 5 });
    expect(captionAt(cues(cut.events), 0)?.text).toBe("First");
    expect(captionAt(cues(cut.events), 2)).toBeNull();
    const joined = concatRecordings([
      { rec: recording([marker(0, { text: "Persistent" }), [1, "m", "end"]]), config },
      { rec: recording([[0, "o", "next"], [1, "m", "end"]]), config },
    ]);
    expect(captionAt(cues(joined.events), 1.1)).toBeNull();
  });

  test("word highlighting and pop animation can be sought backwards deterministically", () => {
    const words = cues([marker(0, { text: "one two three", style: "tiktok", duration: 3000 }), [4, "m", "end"]]);
    expect(captionAt(words, 2.5)?.activeWord).toBe(2);
    expect(captionAt(words, 0.5)?.activeWord).toBe(0);
    const pop = cues([marker(0, { text: "Pop", style: "pop" }), [1, "m", "end"]]);
    expect(captionAt(pop, 0)?.scale).toBeLessThan(1);
    expect(captionAt(pop, 0.15)?.scale).toBeGreaterThan(1);
    expect(captionAt(pop, 0.4)?.scale).toBe(1);
  });
});

test("t.caption is nonblocking and never writes text into the terminal", async () => {
  const rec = await record(resolveConfig({ output: "x.svg", typingSpeed: 0, endPause: 0 }), async (t) => {
    await t.caption("Only in subtitles", { duration: "10s", style: "tiktok", position: "top", offset: 64, fontSize: 36 });
    await t.run("echo terminal-only");
    await t.caption(null);
    await expect(t.caption("bad", { fontSize: NaN })).rejects.toThrow("fontSize");
    await expect(t.caption("bad", { duration: -1 })).rejects.toThrow("duration");
    for (const offset of [-1, NaN, Infinity]) await expect(t.caption("bad", { offset })).rejects.toThrow("offset");
  });
  const caption = rec.events.find((e) => e[2].startsWith("caption:{"))!;
  const clear = rec.events.find((e) => e[2] === "caption:null")!;
  expect(clear[0] - caption[0]).toBeLessThan(5);
  expect(rec.events.filter((e) => e[1] === "o").map((e) => e[2]).join("")).not.toContain("Only in subtitles");
  expect(JSON.parse(caption[2].slice(8))).toMatchObject({ duration: 10000, style: "tiktok", position: "top", offset: 64, fontSize: 36 });
}, 30_000);

test("HTML, animated SVG and SVG snapshots contain styled, escaped captions", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tcut-caption-svg-"));
  try {
    const config = resolveConfig({ output: `${dir}/x.svg`, fps: 10 });
    const rec = recording([[0, "o", "terminal"], marker(0.1, { text: '<hello> & </script>', style: "tiktok", duration: 900 }), [1.1, "m", "end"]]);
    const html = await buildHtml(rec, config);
    expect(html).toContain('id="caption"');
    expect(html).toContain('"captions":[{"start":0.1');
    expect(html).not.toContain('<hello> & </script>');
    const svg = (await buildSvg(rec, config)).svg;
    expect(svg).toContain("&lt;hello&gt;");
    expect(svg).toContain('fill="#baff29"');
    await writeSvgSnapshots(rec, config, [{ file: `${dir}/on.svg`, at: 0.5 }, { file: `${dir}/off.svg`, at: 1 }]);
    expect(await Bun.file(`${dir}/on.svg`).text()).toContain('class="caption"');
    expect(await Bun.file(`${dir}/off.svg`).text()).not.toContain('class="caption"');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 30_000);

test("raster captions repaint over an idle terminal and clear at expiry", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "tcut-caption-raster-"));
  try {
    const rec = recording([[0, "o", "\x1b[?25lstill terminal"], marker(0.1, { text: "One two", style: "tiktok", duration: 400 }), marker(0.6, { text: "Pop!", style: "pop", duration: 400 }), [1.1, "m", "end"]]);
    await render(rec, resolveConfig({ output: `${dir}/`, fps: 10, cursor: { blink: false } }));
    const files = (await readdir(dir)).filter((f) => f.endsWith(".png")).sort();
    const bytes = await Promise.all(files.map((file) => Bun.file(path.join(dir, file)).bytes()));
    expect(bytes[0]).not.toEqual(bytes[1]); // overlay changed, terminal did not
    expect(bytes[1]).not.toEqual(bytes[4]); // highlighted word changes
    expect(bytes[6]).not.toEqual(bytes[7]); // pop animates
    expect(bytes[0]).toEqual(bytes[5]); // expiry restores the clean terminal
    expect(bytes[0]).toEqual(bytes[10]);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}, 60_000);

test("HTML player seeks captions backwards, preserves offsets, clears expiry, and wraps literal text safely", async () => {
  const { createWebView } = await import("../src/renderer/view");
  const config = resolveConfig({ output: "x.html", cols: 30, rows: 12 });
  const text = "<script>" + "a".repeat(90) + "\nsecond line";
  const rec = recording([[0, "o", "screen"], marker(0, { text, duration: 2000, style: "tiktok", position: "top", offset: 48, fontSize: 32, highlightColor: "#ff00ff" }), [4, "m", "end"]]);
  const html = await buildHtml(rec, config);
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: () => new Response(html, { headers: { "content-type": "text/html" } }) });
  const view = createWebView({ width: 1100, height: 700 });
  try {
    await view.navigate(server.url.href);
    for (let i = 0; i < 100; i++) {
      if (await view.evaluate<boolean>('document.getElementById("play").textContent === "❚❚"')) break;
      await Bun.sleep(20);
    }
    expect(await view.evaluate<string>('document.getElementById("play").textContent')).toBe("❚❚");
    await view.evaluate('document.getElementById("play").click()');
    const seek = (value: number) => view.evaluate<boolean>(`(() => { const p = document.getElementById("progress"); p.value = "${value}"; p.dispatchEvent(new Event("input")); return document.getElementById("caption").hidden; })()`);
    expect(await seek(750)).toBe(true);
    expect(await seek(100)).toBe(false);
    expect(await view.evaluate<string>('document.getElementById("caption").textContent')).toBe(text);
    expect(await view.evaluate<number>('document.querySelectorAll("#caption script").length')).toBe(0);
    expect(await view.evaluate<boolean>('document.querySelector("#caption > span").scrollWidth <= document.getElementById("caption").clientWidth')).toBe(true);
    expect(await view.evaluate<string>('getComputedStyle(document.getElementById("caption")).top')).toBe("48px");
    expect(await view.evaluate<string>('getComputedStyle(document.querySelector("#caption > span > span")).color')).toBe("rgb(255, 0, 255)");
  } finally {
    view.close();
    await server.stop(true);
  }
}, 30_000);

test("key chips move above bottom captions and return after clearing", async () => {
  const { createWebView } = await import("../src/renderer/view");
  const { renderHtml } = await import("../src/renderer/page");
  const { pageAssets } = await import("../src/renderer/bundle");
  const assets = await pageAssets();
  const html = renderHtml(resolveConfig({ output: "x.png", keys: true, windowBar: "colorful" }));
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/app.js") return new Response(assets.js, { headers: { "content-type": "text/javascript" } });
    if (url.pathname === "/wterm.css") return new Response(assets.css, { headers: { "content-type": "text/css" } });
    return new Response(html, { headers: { "content-type": "text/html" } });
  } });
  const view = createWebView({ width: 900, height: 600 });
  try {
    await view.navigate(server.url.href);
    for (let i = 0; i < 100; i++) {
      if (await view.evaluate<boolean>('Boolean(window.__vt)')) break;
      await Bun.sleep(20);
    }
    await view.evaluate('(() => { window.__vt.layout(800, 500, 720, 400); return window.__vt.keys(["Enter"]); })()');
    const caption = captionAt(cues([marker(0, { text: "Subtitles stay readable", offset: 64 }), [1, "m", "end"]]), 0);
    await view.evaluate(`window.__vt.caption(${JSON.stringify(caption)})`);
    expect(await view.evaluate<boolean>('document.getElementById("keys").getBoundingClientRect().bottom < document.getElementById("caption").getBoundingClientRect().top')).toBe(true);
    expect(await view.evaluate<string>('getComputedStyle(document.getElementById("caption")).bottom')).toBe("64px");
    await view.evaluate(`window.__vt.caption(${JSON.stringify({ ...caption, position: "top", offset: 48 })})`);
    expect(await view.evaluate<number>('document.getElementById("caption").getBoundingClientRect().top - document.getElementById("bar").getBoundingClientRect().bottom')).toBe(48);
    await view.evaluate('window.__vt.caption(null)');
    expect(await view.evaluate<string>('document.getElementById("keys").style.transform')).toBe("");
  } finally {
    view.close();
    await server.stop(true);
  }
}, 30_000);

test("caption offsets preserve defaults and move SVG subtitles from either edge", async () => {
  const config = resolveConfig({ output: "x.svg" });
  const position = async (spec: CaptionSpec) => {
    const rec = recording([marker(0, spec), [1, "m", "end"]]);
    const svg = (await buildSvg(rec, config)).svg;
    const match = /<g class="caption"[\s\S]*?<rect[^>]* y="([^"]+)"/.exec(svg);
    expect(match).not.toBeNull();
    return Number(match![1]);
  };
  expect(captionAt(cues([marker(0, { text: "Hello" }), [1, "m", "end"]]), 0)?.offset).toBe(16);
  for (const style of ["classic", "tiktok", "pop", "minimal"] as const) {
    const baseline = await position({ text: "Hello", style });
    expect(baseline - await position({ text: "Hello", style, offset: 64 })).toBeCloseTo(48);
    expect(await position({ text: "Hello", style, position: "top", offset: 0 })).toBe(0);
    expect(await position({ text: "Hello", style, position: "top", offset: 48 })).toBe(48);
  }
});
