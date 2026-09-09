import path from "node:path";
import { MARKER, readCast } from "./cast";
import { applyOverrides, resolveConfig } from "./config";
import { flattenRecording, flattenedConfig } from "./edit";
import { frameText, replayFrames, type GridFrame } from "./export/frames";
import { renderOutputs } from "./render";
import type { Recording, ResolvedConfig } from "./types";

export interface DiffOptions {
  /** Compare the screen at this time on the visible timeline (seconds). Default: the last frame. */
  at?: number;
  /** Write `a.png` / `b.png` of the compared frames into this directory. */
  images?: string;
}

export interface DiffResult {
  equal: boolean;
  a: string[];
  b: string[];
  /** Unified-ish diff lines ("  same", "- only in a", "+ only in b"). */
  lines: string[];
  images?: { a: string; b: string };
}

function frameAt(frames: GridFrame[], at: number | undefined): GridFrame {
  if (at === undefined) return frames[frames.length - 1]!;
  let chosen = frames[0]!;
  for (const f of frames) if (f.time <= at + 1e-9) chosen = f;
  return chosen;
}

/** Simple LCS-based line diff — screens are small, so O(n·m) is fine. */
function diffLines(a: string[], b: string[]): string[] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array.from({ length: m + 1 }, () => 0));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i]![j] = a[i] === b[j] ? dp[i + 1]![j + 1]! + 1 : Math.max(dp[i + 1]![j]!, dp[i]![j + 1]!);
  const out: string[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push(`  ${a[i]}`);
      i++;
      j++;
    } else if (dp[i + 1]![j]! >= dp[i]![j + 1]!) {
      out.push(`- ${a[i]}`);
      i++;
    } else {
      out.push(`+ ${b[j]}`);
      j++;
    }
  }
  while (i < n) out.push(`- ${a[i++]}`);
  while (j < m) out.push(`+ ${b[j++]}`);
  return out;
}

async function screenOf(rec: Recording, at: number | undefined): Promise<{ text: string[]; config: ResolvedConfig; time: number }> {
  const base = rec.header.bunVideo ?? resolveConfig({ output: "x.svg", cols: rec.header.width, rows: rec.header.height });
  const config = applyOverrides(base, {});
  const replay = await replayFrames(rec, config);
  const frame = frameAt(replay.frames, at);
  const lastTick = Math.max(0, Math.round(replay.duration * config.fps) - 1) / config.fps;
  const time = at === undefined ? lastTick : Math.min(lastTick, Math.floor((at + 1e-9) * config.fps) / config.fps);
  return { text: frameText(frame), config, time };
}

async function renderComparedFrame(rec: Recording, config: ResolvedConfig, time: number, file: string): Promise<void> {
  const flat = flattenRecording(rec, config);
  // Use the same sampled frame as the text comparison, including t=0. Existing snapshot marks
  // belong to the original render and must not write unrelated files during a diff.
  flat.events = flat.events.filter(([t, type, data]) => t <= time + 1e-9 && !(type === "m" && (data === MARKER.end || data.startsWith(MARKER.screenshot))));
  flat.events.push([time, "m", MARKER.end]);
  flat.header.duration = time;
  await renderOutputs(flat, { ...flattenedConfig(config), output: [file] });
}

/** Compare what two recordings show on screen (text, not pixels) at the end or at a given time. */
export async function diffCasts(fileA: string, fileB: string, opts: DiffOptions = {}): Promise<DiffResult> {
  if (opts.at !== undefined && (!Number.isFinite(opts.at) || opts.at < 0)) throw new Error("diff at must be a finite non-negative time");
  const [recA, recB] = await Promise.all([readCast(fileA), readCast(fileB)]);
  const [a, b] = await Promise.all([screenOf(recA, opts.at), screenOf(recB, opts.at)]);
  const equal = a.text.length === b.text.length && a.text.every((line, i) => line === b.text[i]);
  const result: DiffResult = { equal, a: a.text, b: b.text, lines: equal ? [] : diffLines(a.text, b.text) };
  if (opts.images) {
    const dir = path.resolve(opts.images);
    const pa = path.join(dir, "a.png");
    const pb = path.join(dir, "b.png");
    await renderComparedFrame(recA, a.config, a.time, pa);
    await renderComparedFrame(recB, b.config, b.time, pb);
    result.images = { a: pa, b: pb };
  }
  return result;
}
