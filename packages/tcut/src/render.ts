import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chapterRanges, chapterSlug, cutRecording, findChapters, flattenedConfig, selectChapters } from "./edit";
import { frameText, replayFrames } from "./export/frames";
import { writeHtml } from "./export/html";
import { writeSvg } from "./export/svg";
import { render as renderRaster, type RenderResult } from "./renderer/webview";
import type { ClipSelection, Recording, RenderProgress, ResolvedConfig } from "./types";

export type { RenderResult };

const kind = (output: string): "svg" | "html" | "txt" | "log" | "raster" => {
  if (output.endsWith("/")) return "raster";
  const ext = path.extname(output).toLowerCase();
  if (ext === ".svg") return "svg";
  if (ext === ".html" || ext === ".htm") return "html";
  if (ext === ".txt") return "txt";
  if (ext === ".log") return "log";
  return "raster";
};

/** The whole transcript as text: every line that scrolled off, then the final screen. */
export async function writeLog(rec: Recording, config: ResolvedConfig, file: string): Promise<void> {
  const replay = await replayFrames(rec, config);
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await Bun.write(file, replay.transcript.join("\n") + "\n");
}

/** The final screen as plain text (what `t.screen()` would return at the end). */
export async function writeTxt(rec: Recording, config: ResolvedConfig, file: string): Promise<void> {
  const replay = await replayFrames(rec, config);
  const last = replay.frames[replay.frames.length - 1];
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await Bun.write(file, (last ? frameText(last) : []).join("\n") + "\n");
}

/**
 * Fan the configured outputs out to the right backend: `.svg` and `.html` are produced from the headless core
 * (no WebView, no ffmpeg); everything else goes through the WebView + ffmpeg renderer in one pass.
 */
export async function renderOutputs(
  rec: Recording,
  config: ResolvedConfig,
  onProgress?: (p: RenderProgress) => void,
): Promise<RenderResult> {
  const svg = config.output.filter((o) => kind(o) === "svg");
  const html = config.output.filter((o) => kind(o) === "html");
  const txt = config.output.filter((o) => kind(o) === "txt");
  const logs = config.output.filter((o) => kind(o) === "log");
  const raster = config.output.filter((o) => kind(o) === "raster");

  const result: RenderResult = { outputs: [], frames: 0, screenshots: [], durationSeconds: 0 };

  for (const file of txt) {
    await writeTxt(rec, config, file);
    result.outputs.push(file);
  }
  for (const file of logs) {
    await writeLog(rec, config, file);
    result.outputs.push(file);
  }
  for (const file of svg) {
    await mkdir(path.dirname(path.resolve(file)), { recursive: true });
    const r = await writeSvg(rec, config, file);
    result.outputs.push(file);
    result.frames = Math.max(result.frames, r.frames);
    result.durationSeconds = r.duration;
  }
  for (const file of html) {
    await writeHtml(rec, config, file);
    result.outputs.push(file);
  }
  if (raster.length > 0) {
    const r = await renderRaster(rec, { ...config, output: raster }, onProgress);
    result.outputs.push(...r.outputs);
    result.frames = r.frames;
    result.screenshots.push(...r.screenshots);
    result.durationSeconds = r.durationSeconds;
    if (r.notes) result.notes = r.notes;
  }
  return result;
}

/** "demo.mp4" + "-01-install" → "demo-01-install.mp4"; "frames/" → "frames-01-install/". */
function suffixOutput(output: string, suffix: string): string {
  if (output.endsWith("/")) return `${output.slice(0, -1)}${suffix}/`;
  const ext = path.extname(output);
  return `${output.slice(0, output.length - ext.length)}${suffix}${ext}`;
}

/**
 * Render a part of the recording: a time window, a set of chapters, or every chapter as its own file.
 * Cutting happens on the cast (see edit.ts), so every output format is supported.
 */
export async function renderSelection(
  rec: Recording,
  config: ResolvedConfig,
  clip: ClipSelection | undefined,
  onProgress?: (p: RenderProgress) => void,
): Promise<RenderResult> {
  if (!clip || (clip.from === undefined && clip.to === undefined && !clip.chapters && !clip.splitChapters)) {
    return renderOutputs(rec, config, onProgress);
  }
  if (clip.splitChapters) {
    let ranges = chapterRanges(rec, config);
    if (clip.chapters) ranges = findChapters(ranges, clip.chapters);
    if (ranges.length === 0) throw new Error("--split-chapters needs chapters: add `t.chapter(name)` calls to the script");
    const total: RenderResult = { outputs: [], frames: 0, screenshots: [], durationSeconds: 0 };
    for (const [i, range] of ranges.entries()) {
      const part = cutRecording(rec, config, range);
      const suffix = `-${chapterSlug(i, range.title)}`;
      const r = await renderOutputs(part, { ...flattenedConfig(config), output: config.output.map((o) => suffixOutput(o, suffix)) }, onProgress);
      total.outputs.push(...r.outputs);
      total.frames += r.frames;
      total.screenshots.push(...r.screenshots);
      total.durationSeconds += r.durationSeconds;
      if (r.notes) total.notes = [...(total.notes ?? []), ...r.notes];
    }
    return total;
  }
  let part = rec;
  let partConfig = config;
  if (clip.chapters) {
    part = selectChapters(rec, config, clip.chapters);
    partConfig = flattenedConfig(config);
  }
  if (clip.from !== undefined || clip.to !== undefined) {
    part = cutRecording(part, partConfig, clip);
    partConfig = flattenedConfig(partConfig);
  }
  return renderOutputs(part, partConfig, onProgress);
}
