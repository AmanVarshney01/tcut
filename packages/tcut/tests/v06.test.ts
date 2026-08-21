import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { writeCast } from "../src/cast";
import { resolveConfig } from "../src/config";
import { normalizeUrl } from "../src/browser";
import { diffCasts } from "../src/diff";
import { keyChips, keyLabels } from "../src/keylabels";
import { applyPreset } from "../src/presets";
import { record } from "../src/recorder";
import { render } from "../src/renderer/webview";
import { buildTimeline } from "../src/timeline";
import type { CastEvent, Recording } from "../src/types";

const dir = "/tmp/tcut-v06-test";
const cli = path.join(import.meta.dir, "..", "src", "cli.ts");

describe("idle compression", () => {
  test("caps gaps to maxPause and keeps order", () => {
    const events: CastEvent[] = [
      [0, "o", "a"],
      [0.5, "o", "b"],
      [41, "o", "c"], // 40.5 s idle
      [41.2, "o", "d"],
      [60, "m", "end"],
    ];
    const t = buildTimeline(events, 1, { maxPause: 1 });
    expect(t.events.map((e) => Number(e.vt.toFixed(2)))).toEqual([0, 0.5, 1.5, 1.7, 2.7]);
    expect(t.duration).toBeCloseTo(2.7, 5);
    const untouched = buildTimeline(events, 1);
    expect(untouched.duration).toBe(60);
  });
});

describe("key overlay", () => {
  test("labels", () => {
    expect(keyLabels("ls\r")).toEqual(["ls", "⏎"]);
    expect(keyLabels("\x03")).toEqual(["⌃C"]);
    expect(keyLabels("\x1b[A\x1b[Z\x7f")).toEqual(["↑", "⇧⇥", "⌫"]);
    expect(keyLabels("\x1bb")).toEqual(["⌥b"]);
  });
  test("printable runs merge into words, named keys stand alone", () => {
    const chips = keyChips([
      { vt: 0, data: "g" },
      { vt: 0.1, data: "i" },
      { vt: 0.2, data: "t" },
      { vt: 0.3, data: "\r" },
      { vt: 2, data: "q" },
    ]);
    expect(chips.map((c) => c.label)).toEqual(["git", "⏎", "q"]);
    expect(chips[0]!.at).toBe(0.2);
    const withSpace = keyChips([
      { vt: 0, data: "l" }, { vt: 0.05, data: "s" }, { vt: 0.1, data: " " }, { vt: 0.15, data: "-la" },
    ]);
    expect(withSpace.map((c) => c.label)).toEqual(["ls -la"]);
  });
  test("limit defaults to one chip at a time", () => {
    const r = resolveConfig({ output: "x.mp4", keys: true });
    expect(r.keys?.limit).toBe(1);
    expect(resolveConfig({ output: "x.mp4", keys: { limit: 3 } }).keys?.limit).toBe(3);
  });
});

describe("browser urls", () => {
  test("scheme added when missing, localhost stays http", () => {
    expect(normalizeUrl("better-t-stack.dev")).toBe("https://better-t-stack.dev");
    expect(normalizeUrl("localhost:5173")).toBe("http://localhost:5173");
    expect(normalizeUrl("http://x.dev")).toBe("http://x.dev");
    expect(normalizeUrl("about:blank")).toBe("about:blank");
  });
});

describe("presets", () => {
  test("apply under explicit config", () => {
    const c = applyPreset({ output: "x.mp4", preset: "x", fps: 24 });
    expect(c.width).toBe(1280);
    expect(c.fps).toBe(24);
    const r = resolveConfig({ output: "x.mp4", preset: "readme" });
    expect(r.cols).toBe(80);
    expect(r.font.size).toBe(18);
    expect(() => applyPreset({ output: "x", preset: "nope" as never })).toThrow(/Unknown preset/);
  });
});

describe("zoom + chapters", () => {
  test("markers are recorded and chapters reach the mp4", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const rec = await record(resolveConfig({ output: `${dir}/x.mp4`, endPause: 0, typingSpeed: 0, cols: 40, rows: 10 }), async (t) => {
      await t.chapter("Intro");
      await t.run("echo one");
      await t.zoom({ rows: [0, 2], duration: "200ms" });
      await t.sleep(300);
      await t.zoom(null);
      await t.chapter("Outro");
      await t.run("echo two");
    });
    const markers = rec.events.filter((e) => e[1] === "m").map((e) => e[2]);
    expect(markers.some((m) => m.startsWith("zoom:{"))).toBe(true);
    expect(markers).toContain("zoom:null");
    expect(markers.filter((m) => m.startsWith("chapter:"))).toEqual(["chapter:Intro", "chapter:Outro"]);

    const out = path.join(dir, "chapters.mp4");
    const result = await render(rec, resolveConfig({ output: out, fps: 10, keys: true }));
    expect(result.chapters?.map((c) => c.title)).toEqual(["Intro", "Outro"]);
    if (Bun.which("ffprobe")) {
      const p = Bun.spawn(["ffprobe", "-v", "error", "-show_chapters", "-of", "json", out], { stdout: "pipe" });
      const info = JSON.parse(await new Response(p.stdout).text()) as { chapters: Array<{ tags?: { title?: string } }> };
      expect(info.chapters.map((c) => c.tags?.title)).toEqual(["Intro", "Outro"]);
    }
  }, 60_000);
});

describe("tcut diff", () => {
  const mk = (text: string): Recording => ({ header: { version: 2, width: 30, height: 5 }, events: [[0, "o", `> echo\r\n${text}\r\n> `], [0.2, "m", "end"]] });
  test("equal and different screens", async () => {
    await mkdir(dir, { recursive: true });
    const a = path.join(dir, "a.cast");
    const b = path.join(dir, "b.cast");
    const c = path.join(dir, "c.cast");
    await writeCast(a, mk("same"));
    await writeCast(b, mk("same"));
    await writeCast(c, mk("changed"));
    expect((await diffCasts(a, b)).equal).toBe(true);
    const d = await diffCasts(a, c);
    expect(d.equal).toBe(false);
    expect(d.lines).toContain("- same");
    expect(d.lines).toContain("+ changed");
    const p = Bun.spawn(["bun", cli, "diff", a, c, "--json"], { stdout: "pipe", stderr: "pipe" });
    const [code, out] = await Promise.all([p.exited, new Response(p.stdout).text()]);
    expect(code).toBe(1);
    expect(JSON.parse(out).equal).toBe(false);
  }, 30_000);
});

describe("rec --browser", () => {
  test("live recording captures browser frames", async () => {
    const server = Bun.serve({ port: 0, fetch: () => new Response("<h1 style='font-size:60px'>live</h1>", { headers: { "content-type": "text/html" } }) });
    try {
      const cast = path.join(dir, "rec.cast");
      const p = Bun.spawn(
        ["bun", cli, "rec", "--record-only", "--cast", cast, "--browser", `http://127.0.0.1:${server.port}/`, "--cols", "40", "--rows", "10", "-q", "--", "bash", "-c", "sleep 1.2; echo done"],
        { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
      );
      const [code, err] = await Promise.all([p.exited, new Response(p.stderr).text()]);
      expect(err).toBe("");
      expect(code).toBe(0);
      const text = await Bun.file(cast).text();
      expect(text).toContain('"b","rec.browser/');
    } finally {
      server.stop(true);
    }
  }, 60_000);
});
