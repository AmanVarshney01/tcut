import { mkdir } from "node:fs/promises";
import path from "node:path";
import { MARKER } from "../cast";
import type { Recording, RenderProgress, ResolvedConfig } from "../types";
import { fitFrame, loopOffsetFrames, rotateFrames } from "../loop";
import { buildTimeline, withReinjection, type TimedEvent } from "../timeline";
import { pageAssets } from "./bundle";
import { createSinks, type Chapter } from "./encoder";
import { chipBuilder } from "../keylabels";
import { BROWSER_GAP, barHeight, renderHtml, themeOsc } from "./page";

export interface RenderResult {
  outputs: string[];
  frames: number;
  screenshots: string[];
  durationSeconds: number;
  chapters?: Chapter[];
}

interface ZoomRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Grid region (inclusive rows/cols, padded by `padding` cells) → px rect relative to the terminal grid. */
function zoomRect(spec: { rows?: [number, number]; cols?: [number, number]; padding?: number }, cols: number, rows: number, cell: { w: number; h: number }): ZoomRect {
  const pad = spec.padding ?? 1;
  const r0 = Math.max(0, (spec.rows?.[0] ?? 0) - pad);
  const r1 = Math.min(rows - 1, (spec.rows?.[1] ?? rows - 1) + pad);
  const c0 = Math.max(0, (spec.cols?.[0] ?? 0) - pad);
  const c1 = Math.min(cols - 1, (spec.cols?.[1] ?? cols - 1) + pad);
  return { x: c0 * cell.w, y: r0 * cell.h, w: (c1 - c0 + 1) * cell.w, h: (r1 - r0 + 1) * cell.h };
}

const easeInOut = (p: number) => (p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2);

/** Where the zoom is at `time`, interpolating from → to over [start, start + duration]. null = no zoom. */
function currentZoom(from: ZoomRect | null, to: ZoomRect | null, start: number, duration: number, time: number, full?: ZoomRect): ZoomRect | null {
  if (from === null && to === null) return null;
  const p = duration <= 0 ? 1 : Math.min(1, Math.max(0, (time - start) / duration));
  if (p >= 1) return to;
  const e = easeInOut(p);
  const a = from ?? to!; // from null = "unzoomed": treat as the target's containing box expanded; approximate with target
  const b = to ?? from!;
  const lerp = (u: number, v: number) => u + (v - u) * e;
  // Zooming from/to "no zoom" needs the full grid rect; callers pass it via `full` when known.
  const A = from ?? full ?? a;
  const B = to ?? full ?? b;
  return { x: lerp(A.x, B.x), y: lerp(A.y, B.y), w: lerp(A.w, B.w), h: lerp(A.h, B.h) };
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

  const timeline = buildTimeline(rec.events, config.playbackSpeed, { keepInput: Boolean(config.keys), maxPause: config.maxPause });
  const lite = config.core === "lite";
  const events = lite ? timeline.events : withReinjection(timeline.events, osc);
  // Key overlay chips come from input events; zoom/chapter markers are read as the clock passes them.
  const keyEvents = config.keys ? events.filter((e) => e.type === "i") : [];
  const chipper = chipBuilder((config.keys?.merge ?? 350) / 1000);
  let keyIdx = 0;
  const chapters: Chapter[] = events
    .filter((e) => e.type === "m" && e.data.startsWith(MARKER.chapter))
    .map((e) => ({ title: e.data.slice(MARKER.chapter.length), start: e.vt }));
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
    const { frameW, frameH, padX, padY } = fit;
    // The browser pane extends the canvas sideways (left/right) or vertically (top/bottom).
    const even = (n: number) => (n % 2 === 0 ? n : n + 1);
    const position = config.browser?.position ?? "right";
    const stacked = position === "top" || position === "bottom";
    const overlay = position === "overlay";
    let width = fit.width;
    let height = fit.height;
    if (hasBrowser && config.browser) {
      if (overlay) {
        const paneW = config.browser.width;
        const paneH = config.browser.height || 480;
        const ox = config.browser.offset?.x ?? Math.round(frameW * 0.42);
        const oy = config.browser.offset?.y ?? Math.round(frameH * 0.18);
        width = even(config.margin * 2 + Math.max(frameW, ox + paneW));
        height = even(config.margin * 2 + Math.max(frameH, oy + paneH));
        await view.evaluate(`window.__vt.browserOffset(${ox}, ${oy}, ${paneW}, ${paneH})`);
      } else if (stacked) {
        height = even(fit.height + BROWSER_GAP + (config.browser.height || 480));
      } else {
        width = even(fit.width + BROWSER_GAP + config.browser.width);
      }
    }
    await view.evaluate(`window.__vt.layout(${frameW}, ${frameH}, ${termW}, ${termH}, ${padX}, ${padY})`);
    await view.resize(width, height);
    await view.evaluate("new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true))))");

    const sinks = await createSinks(config.output, fps, { chapters, durationSeconds: timeline.duration });
    const cellPx = cell;
    const fullRect: ZoomRect = { x: 0, y: 0, w: termW, h: termH };
    let zoomFrom: ZoomRect | null = null;
    let zoomTo: ZoomRect | null = null;
    let zoomStart = 0;
    let zoomDuration = 0;
    let zoomApplied: string | null = null;
    let lastChips = "";
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
      const focusChanged = hasBrowser && batch.some((e) => e.type === "m" && e.data.startsWith(MARKER.focus));
      let dirty = lastPng === null || drawable.length > 0 || blinkOn !== lastBlink || browserFrame !== undefined || focusChanged;

      if (drawable.length > 0) {
        const id = ++batchId;
        batches.set(id, JSON.stringify(drawable.map(({ type, data }) => ({ type, data }))));
        await view.evaluate(`window.__vt.applyUrl('/batch/${id}')`);
      }
      if (browserFrame) {
        await view.evaluate(`window.__vt.browserFrame(${JSON.stringify(`/bframe/${encodeURIComponent(browserFrame.data)}`)})`);
      }
      const focus = hasBrowser ? batch.filter((e) => e.type === "m" && e.data.startsWith(MARKER.focus)).at(-1) : undefined;
      if (focus) {
        await view.evaluate(`window.__vt.focus(${JSON.stringify(focus.data.slice(MARKER.focus.length))})`);
      }

      // Zoom markers start an animation on the render clock; interpolate until it lands.
      const zoomMarker = batch.filter((e) => e.type === "m" && e.data.startsWith(MARKER.zoom)).at(-1);
      if (zoomMarker) {
        const spec = JSON.parse(zoomMarker.data.slice(MARKER.zoom.length)) as null | { rows?: [number, number]; cols?: [number, number]; duration?: number; padding?: number };
        zoomFrom = currentZoom(zoomFrom, zoomTo, zoomStart, zoomDuration, time, fullRect);
        zoomTo = spec ? zoomRect(spec, rec.header.width, rec.header.height, cellPx) : null;
        zoomStart = time;
        zoomDuration = (spec?.duration ?? 400) / 1000;
      }
      const zoomNow = currentZoom(zoomFrom, zoomTo, zoomStart, zoomDuration, time, fullRect);
      const zoomKey = zoomNow ? `${zoomNow.x.toFixed(1)},${zoomNow.y.toFixed(1)},${zoomNow.w.toFixed(1)},${zoomNow.h.toFixed(1)}` : "";
      let zoomChanged = false;
      if (zoomKey !== zoomApplied) {
        await view.evaluate(`window.__vt.zoom(${zoomNow ? JSON.stringify(zoomNow) : "null"})`);
        zoomApplied = zoomKey;
        zoomChanged = true;
      }

      // Key chips visible at this instant.
      let chipsChanged = false;
      if (config.keys) {
        const ttl = config.keys.ttl / 1000;
        while (keyIdx < keyEvents.length && keyEvents[keyIdx]!.vt <= time + 1e-9) {
          chipper.push(keyEvents[keyIdx]!.vt, keyEvents[keyIdx]!.data);
          keyIdx += 1;
        }
        const visible = chipper.chips.filter((c) => time - c.at < ttl).slice(-config.keys.limit).map((c) => c.label);
        const key = visible.join("\u0000");
        if (key !== lastChips) {
          await view.evaluate(`window.__vt.keys(${JSON.stringify(visible)})`);
          lastChips = key;
          chipsChanged = true;
        }
      }
      if (blinkOn !== lastBlink) {
        await view.evaluate(`window.__vt.cursor(${blinkOn})`);
        lastBlink = blinkOn;
      }
      if (zoomChanged || chipsChanged) dirty = true;
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
    return { outputs: sinks.map((s) => s.target), frames: totalFrames, screenshots, durationSeconds: timeline.duration, chapters };
  } finally {
    view.close();
    server.stop(true);
  }
}
