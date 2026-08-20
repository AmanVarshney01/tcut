import { mkdir } from "node:fs/promises";
import path from "node:path";
import { MARKER } from "../cast";
import type { Recording, RenderProgress, ResolvedConfig } from "../types";
import { fitFrame, loopOffsetFrames, rotateFrames } from "../loop";
import { buildTimeline, withReinjection, type TimedEvent } from "../timeline";
import { pageAssets } from "./bundle";
import { createSinks } from "./encoder";
import { BROWSER_GAP, barHeight, renderHtml, themeOsc } from "./page";

export interface RenderResult {
  outputs: string[];
  frames: number;
  screenshots: string[];
  durationSeconds: number;
}

export async function render(
  rec: Recording,
  config: ResolvedConfig,
  onProgress?: (p: RenderProgress) => void,
): Promise<RenderResult> {
  if (typeof Bun.WebView !== "function") {
    throw new Error("Bun.WebView is not available in this Bun version. tcut needs Bun >= 1.4.");
  }

  const assets = await pageAssets();
  const html = renderHtml(config);
  const osc = themeOsc(config.theme);
  const castDir = rec.source ? path.dirname(rec.source) : process.cwd();
  const hasBrowser = Boolean(config.browser) && rec.events.some((e) => e[1] === "b");
  const batches = new Map<number, string>();
  let batchId = 0;

  const server = Bun.serve({
    port: 0,
    hostname: "127.0.0.1",
    fetch(req) {
      const { pathname } = new URL(req.url);
      if (pathname === "/app.js") return new Response(assets.js, { headers: { "content-type": "text/javascript" } });
      if (pathname === "/wterm.css") return new Response(assets.css, { headers: { "content-type": "text/css" } });
      if (pathname === "/ghostty-vt.wasm") return new Response(Bun.file(assets.wasmPath), { headers: { "content-type": "application/wasm" } });
      if (pathname === "/theme") return new Response(osc, { headers: { "content-type": "text/plain; charset=utf-8" } });
      if (pathname.startsWith("/bframe/")) {
        const rel = decodeURIComponent(pathname.slice("/bframe/".length));
        if (rel.includes("..")) return new Response("forbidden", { status: 403 });
        return new Response(Bun.file(path.join(castDir, rel)), { headers: { "content-type": "image/png" } });
      }
      if (pathname.startsWith("/batch/")) {
        const id = Number(pathname.slice("/batch/".length));
        const body = batches.get(id);
        batches.delete(id);
        if (body === undefined) return new Response("[]", { status: 404, headers: { "content-type": "application/json" } });
        return new Response(body, { headers: { "content-type": "application/json; charset=utf-8" } });
      }
      return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
    },
  });

  const timeline = buildTimeline(rec.events, config.playbackSpeed);
  const lite = config.core === "lite";
  const events = lite ? timeline.events : withReinjection(timeline.events, osc);
  const fps = config.fps;
  const totalFrames = Math.max(1, Math.ceil(timeline.duration * fps) + 1);
  const blinkPeriod = config.cursor.period / 1000;
  const screenshots: string[] = [];

  const view = new Bun.WebView({ width: 800, height: 600 });
  try {
    await view.navigate(`http://127.0.0.1:${server.port}/`);
    for (let i = 0; i < 100; i++) {
      if ((await view.evaluate("typeof window.__vt === 'object'")) === true) break;
      await Bun.sleep(50);
    }
    const boot = {
      cols: rec.header.width,
      rows: rec.header.height,
      foreground: config.theme.foreground,
      background: config.theme.background,
      wasmUrl: "/ghostty-vt.wasm",
      core: config.core,
    };
    await view.evaluate(`window.__vt.boot(${JSON.stringify(boot)})`);
    if (!lite) await view.evaluate("window.__vt.writeUrl('/theme')");

    const cell = (await view.evaluate("window.__vt.measure()")) as { w: number; h: number };
    if (!cell || !(cell.w > 0) || !(cell.h > 0)) throw new Error("Could not measure terminal cell size");

    const termW = Math.ceil(rec.header.width * cell.w);
    const termH = Math.ceil(rec.header.height * cell.h);
    const fit = fitFrame({
      termW,
      termH,
      padding: config.padding,
      margin: config.margin,
      bar: barHeight(config),
      width: config.width,
      height: config.height,
    });
    const { frameW, frameH, padX, padY, height } = fit;
    // A browser pane sits to the right of the terminal window and adds to the canvas width.
    const paneW = hasBrowser && config.browser ? BROWSER_GAP + config.browser.width : 0;
    const width = paneW ? (fit.width + paneW) % 2 === 0 ? fit.width + paneW : fit.width + paneW + 1 : fit.width;
    await view.evaluate(`window.__vt.layout(${frameW}, ${frameH}, ${termW}, ${termH}, ${padX}, ${padY})`);
    await view.resize(width, height);
    await view.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))");

    const sinks = await createSinks(config.output, fps);
    // loopOffset rotates the frame order for looping outputs; those frames are buffered and flushed at the end.
    const loopSinks = config.loopOffset ? sinks.filter((s) => s.loops) : [];
    const streamSinks = sinks.filter((s) => !loopSinks.includes(s));
    const buffered: Uint8Array[] = [];
    let pointer = 0;
    let lastPng: Uint8Array | null = null;
    let lastBlink: boolean | null = null;

    for (let frame = 0; frame < totalFrames; frame++) {
      const time = frame / fps;
      const batch: TimedEvent[] = [];
      while (pointer < events.length && events[pointer]!.vt <= time + 1e-9) {
        batch.push(events[pointer]!);
        pointer++;
      }

      const blinkOn = !config.cursor.blink || Math.floor((time / blinkPeriod) * 2) % 2 === 0;
      const drawable = batch.filter((e) => e.type === "o" || e.type === "r");
      const shots = batch.filter((e) => e.type === "m" && e.data.startsWith(MARKER.screenshot));
      const browserFrame = hasBrowser ? batch.filter((e) => e.type === "b").at(-1) : undefined;
      const dirty = lastPng === null || drawable.length > 0 || blinkOn !== lastBlink || browserFrame !== undefined;

      if (drawable.length > 0) {
        const id = ++batchId;
        batches.set(id, JSON.stringify(drawable.map(({ type, data }) => ({ type, data }))));
        await view.evaluate(`window.__vt.applyUrl('/batch/${id}')`);
      }
      if (browserFrame) {
        await view.evaluate(`window.__vt.browserFrame(${JSON.stringify(`/bframe/${encodeURIComponent(browserFrame.data)}`)})`);
      }
      if (blinkOn !== lastBlink) {
        await view.evaluate(`window.__vt.cursor(${blinkOn})`);
        lastBlink = blinkOn;
      }
      if (dirty) {
        lastPng = (await view.screenshot({ encoding: "buffer" })) as Uint8Array;
      }

      for (const shot of shots) {
        const file = shot.data.slice(MARKER.screenshot.length);
        await mkdir(path.dirname(path.resolve(file)), { recursive: true });
        await Bun.write(file, lastPng!);
        screenshots.push(file);
      }

      for (const sink of streamSinks) await sink.frame(lastPng!);
      if (loopSinks.length) buffered.push(lastPng!);
      onProgress?.({ frame: frame + 1, total: totalFrames });
    }

    if (loopSinks.length) {
      const rotated = rotateFrames(buffered, loopOffsetFrames(buffered.length, config.loopOffset));
      for (const png of rotated) for (const sink of loopSinks) await sink.frame(png);
    }
    for (const sink of sinks) await sink.finish();
    return { outputs: sinks.map((s) => s.target), frames: totalFrames, screenshots, durationSeconds: timeline.duration };
  } finally {
    view.close();
    server.stop(true);
  }
}
