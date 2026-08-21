// Cast-level editing: cut, concatenate and select chapters. Everything works on the *visible* timeline (hides
// collapsed, speed and idle compression applied), so the result renders identically in every output format and
// never goes through ffmpeg — a cut cast is still a cast.
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { MARKER } from "./cast";
import { buildTimeline } from "./timeline";
import type { CastEvent, Recording, ResolvedConfig } from "./types";

/** A window on the visible timeline, seconds. Either end may be open. */
export interface ClipRange {
  from?: number;
  to?: number;
}

export interface ChapterRange {
  title: string;
  from: number;
  to: number;
}

const round = (t: number): number => Number(t.toFixed(6));

/** Config a flattened recording should be rendered with: the timing it was flattened on is now baked in. */
export function flattenedConfig(config: ResolvedConfig): ResolvedConfig {
  return { ...config, playbackSpeed: 1 };
}

/**
 * The recording re-timed onto its visible timeline: hidden intervals removed, `playbackSpeed`, `maxPause` and
 * timelapse segments applied, input events kept (the key overlay needs them). Rendering the result with
 * `flattenedConfig(config)` produces the same video as rendering the original with `config`.
 */
export function flattenRecording(rec: Recording, config: ResolvedConfig): Recording {
  const timeline = buildTimeline(rec.events, config.playbackSpeed, { keepInput: true, maxPause: config.maxPause });
  const events: CastEvent[] = timeline.events.map((e) => [round(e.vt), e.type, e.data]);
  return {
    header: { ...rec.header, duration: round(timeline.duration), bunVideo: flattenedConfig(config) },
    events,
    ...(rec.source && { source: rec.source }),
  };
}

/** Duration of a recording: its end marker, or the last event. */
export function recordingDuration(rec: Recording): number {
  const end = rec.events.find((e) => e[1] === "m" && e[2] === MARKER.end);
  if (end) return end[0];
  return rec.events.length ? rec.events[rec.events.length - 1]![0] : 0;
}

const isState = (e: CastEvent): boolean =>
  e[1] === "o" || e[1] === "r" || e[1] === "b" || (e[1] === "m" && (e[2].startsWith(MARKER.zoom) || e[2].startsWith(MARKER.focus)));

/**
 * Keep `[from, to]` of the visible timeline. Everything before `from` that shapes the screen (output, resizes,
 * the last zoom/focus/browser frame) is kept at t=0 so the first frame is right; markers such as chapters and
 * screenshots before `from` are dropped. The result is flattened (see `flattenRecording`).
 */
export function cutRecording(rec: Recording, config: ResolvedConfig, range: ClipRange): Recording {
  const flat = flattenRecording(rec, config);
  const duration = recordingDuration(flat);
  const from = Math.max(0, range.from ?? 0);
  const to = Math.min(duration, range.to ?? duration);
  if (!(to > from)) throw new Error(`Nothing to keep between ${from}s and ${to}s (the recording is ${duration.toFixed(2)}s long)`);

  const preroll: CastEvent[] = [];
  let lastZoom: CastEvent | undefined;
  let lastFocus: CastEvent | undefined;
  let lastBrowser: CastEvent | undefined;
  const kept: CastEvent[] = [];
  for (const e of flat.events) {
    const [t, type, data] = e;
    if (t < from - 1e-9) {
      if (!isState(e)) continue;
      if (type === "o" || type === "r") preroll.push([0, type, data]);
      else if (type === "b") lastBrowser = [0, type, data];
      else if (data.startsWith(MARKER.zoom)) lastZoom = [0, type, data];
      else lastFocus = [0, type, data];
      continue;
    }
    if (t > to + 1e-9) continue;
    if (type === "m" && data === MARKER.end) continue;
    kept.push([round(t - from), type, data]);
  }
  const events: CastEvent[] = [...preroll];
  for (const e of [lastBrowser, lastFocus, lastZoom]) if (e) events.push(e);
  events.push(...kept, [round(to - from), "m", MARKER.end]);
  return { ...flat, header: { ...flat.header, duration: round(to - from) }, events };
}

/** Chapters on the visible timeline; each runs until the next chapter (or the end). */
export function chapterRanges(rec: Recording, config: ResolvedConfig): ChapterRange[] {
  const flat = flattenRecording(rec, config);
  const duration = recordingDuration(flat);
  const starts = flat.events.filter((e) => e[1] === "m" && e[2].startsWith(MARKER.chapter)).map((e) => ({ title: e[2].slice(MARKER.chapter.length), from: e[0] }));
  return starts.map((c, i) => ({ ...c, to: starts[i + 1]?.from ?? duration }));
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

/** File-name friendly chapter label: "02-zoom-in". */
export function chapterSlug(index: number, title: string): string {
  return `${String(index + 1).padStart(2, "0")}-${slug(title) || "chapter"}`;
}

/** Find chapters by title (case/punctuation-insensitive) or 1-based index; throws listing what exists. */
export function findChapters(ranges: ChapterRange[], names: string[]): ChapterRange[] {
  if (ranges.length === 0) throw new Error("This recording has no chapters (add `t.chapter(name)` calls to the script)");
  return names.map((name) => {
    const want = slug(name);
    const index = Number(name);
    const found = ranges.find((r) => slug(r.title) === want) ?? (Number.isInteger(index) && index >= 1 ? ranges[index - 1] : undefined);
    if (!found) throw new Error(`Unknown chapter "${name}". Chapters: ${ranges.map((r, i) => `${i + 1}. ${r.title}`).join(", ")}`);
    return found;
  });
}

export interface ConcatOptions {
  /** Still time between parts, seconds. Default 0. */
  gap?: number;
}

/**
 * Join recordings end to end. Each part is flattened; the terminal is reset (`ESC c`) at every seam so a part
 * starts on a clean screen, and any zoom/focus from the previous part is cleared. Parts must share a grid size.
 */
export function concatRecordings(parts: Array<{ rec: Recording; config: ResolvedConfig }>, opts: ConcatOptions = {}): Recording {
  if (parts.length === 0) throw new Error("concat needs at least one recording");
  const flats = parts.map(({ rec, config }) => flattenRecording(rec, config));
  const first = flats[0]!;
  for (const f of flats) {
    if (f.header.width !== first.header.width || f.header.height !== first.header.height) {
      throw new Error(
        `All recordings must have the same size to be joined: got ${flats.map((x) => `${x.header.width}x${x.header.height}`).join(", ")}. Re-record, or render each separately.`,
      );
    }
  }
  const gap = Math.max(0, opts.gap ?? 0);
  const events: CastEvent[] = [];
  let offset = 0;
  flats.forEach((flat, i) => {
    if (i > 0) {
      events.push([round(offset), "o", "\x1bc"]);
      events.push([round(offset), "m", `${MARKER.zoom}null`]);
      if (flat.events.some((e) => e[1] === "b") || flats[i - 1]!.events.some((e) => e[1] === "b")) events.push([round(offset), "m", `${MARKER.focus}terminal`]);
    }
    for (const [t, type, data] of flat.events) {
      if (type === "m" && data === MARKER.end) continue;
      events.push([round(t + offset), type, data]);
    }
    offset += recordingDuration(flat) + (i < flats.length - 1 ? gap : 0);
  });
  events.push([round(offset), "m", MARKER.end]);
  return { header: { ...first.header, duration: round(offset) }, events };
}

/** Keep only the named chapters, in the order given (non-adjacent chapters are joined). */
export function selectChapters(rec: Recording, config: ResolvedConfig, names: string[]): Recording {
  const ranges = findChapters(chapterRanges(rec, config), names);
  const flat = flattenedConfig(config);
  const parts = ranges.map((r) => ({ rec: cutRecording(rec, config, r), config: flat }));
  return parts.length === 1 ? parts[0]!.rec : concatRecordings(parts);
}

/**
 * Browser frames (`b` events) are paths relative to the cast they were recorded with. When a cut or joined cast
 * is written somewhere else, copy the frames next to it (`<name>.browser/`) and point the events there.
 */
export async function rebaseBrowserFrames(rec: Recording, sourceCast: string | undefined, targetCast: string, prefix = ""): Promise<Recording> {
  const frames = rec.events.filter((e) => e[1] === "b");
  if (frames.length === 0) return rec;
  const fromDir = sourceCast ? path.dirname(path.resolve(sourceCast)) : process.cwd();
  const dirName = `${path.basename(targetCast).replace(/\.cast$/, "")}.browser`;
  const dir = path.join(path.dirname(path.resolve(targetCast)), dirName);
  await mkdir(dir, { recursive: true });
  const moved = new Map<string, string>();
  for (const [, , rel] of frames) {
    if (moved.has(rel)) continue;
    const name = `${prefix}${path.basename(rel)}`;
    await Bun.write(path.join(dir, name), Bun.file(path.join(fromDir, rel)));
    moved.set(rel, `${dirName}/${name}`);
  }
  return { ...rec, events: rec.events.map((e) => (e[1] === "b" ? [e[0], e[1], moved.get(e[2]) ?? e[2]] : e)) };
}
