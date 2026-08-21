import path from "node:path";
import { readCast } from "./cast";
import { applyOverrides, resolveConfig } from "./config";
import { replayFrames, type GridFrame } from "./export/frames";
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

function rowsText(frame: GridFrame): string[] {
  const out: string[] = [];
  for (let y = 0; y < frame.rows; y++) {
    const cells = frame.rows_.get(y);
    out.push(cells ? cells.map((c) => c.text).join("").replace(/\s+$/, "") : "");
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
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

async function screenOf(rec: Recording, at: number | undefined): Promise<{ text: string[]; config: ResolvedConfig }> {
  const base = rec.header.bunVideo ?? resolveConfig({ output: "x.svg", cols: rec.header.width, rows: rec.header.height });
  const config = applyOverrides(base, {});
  const replay = await replayFrames(rec, config);
  return { text: rowsText(frameAt(replay.frames, at)), config };
}

/** Compare what two recordings show on screen (text, not pixels) at the end or at a given time. */
export async function diffCasts(fileA: string, fileB: string, opts: DiffOptions = {}): Promise<DiffResult> {
  const [recA, recB] = await Promise.all([readCast(fileA), readCast(fileB)]);
  const [a, b] = await Promise.all([screenOf(recA, opts.at), screenOf(recB, opts.at)]);
  const equal = a.text.length === b.text.length && a.text.every((line, i) => line === b.text[i]);
  const result: DiffResult = { equal, a: a.text, b: b.text, lines: equal ? [] : diffLines(a.text, b.text) };
  if (opts.images) {
    const dir = path.resolve(opts.images);
    const pa = path.join(dir, "a.png");
    const pb = path.join(dir, "b.png");
    const speedA = opts.at === undefined ? 1 : 1; // stills are the final frame; `at` applies to text only
    await renderOutputs(recA, { ...a.config, output: [pa], playbackSpeed: speedA });
    await renderOutputs(recB, { ...b.config, output: [pb], playbackSpeed: speedA });
    result.images = { a: pa, b: pb };
  }
  return result;
}
