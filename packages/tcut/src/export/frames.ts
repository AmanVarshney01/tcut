import type { CellData, TerminalCore } from "@wterm/core";
import { themeOsc } from "../renderer/page";
import { loadCore } from "../screen";
import { buildTimeline, withReinjection } from "../timeline";
import type { Recording, ResolvedConfig, Theme } from "../types";

export const FLAG = {
  bold: 0x01,
  dim: 0x02,
  italic: 0x04,
  underline: 0x08,
  reverse: 0x20,
  invisible: 0x40,
  strike: 0x80,
} as const;

export interface GridCell {
  text: string;
  /** 1 = normal, 2 = wide (next cell is a continuation and is omitted). */
  width: 1 | 2;
  /** Resolved CSS hex colour, or null for the theme default. */
  fg: string | null;
  bg: string | null;
  flags: number;
}

export interface GridFrame {
  /** Start time on the visible timeline, seconds. */
  time: number;
  /** How long this frame is shown, seconds. */
  hold: number;
  cols: number;
  rows: number;
  /** Sparse rows: index → cells (rows that are entirely blank/default are omitted). */
  rows_: Map<number, GridCell[]>;
  cursor: { row: number; col: number; visible: boolean };
}

/** Visible text of a frame: one string per row, trailing spaces and trailing blank rows removed. */
export function frameText(frame: GridFrame): string[] {
  const out: string[] = [];
  for (let y = 0; y < frame.rows; y++) {
    const cells = frame.rows_.get(y);
    out.push(cells ? cells.map((c) => c.text).join("").replace(/\s+$/, "") : "");
  }
  while (out.length && out[out.length - 1] === "") out.pop();
  return out;
}

export interface GridReplay {
  frames: GridFrame[];
  duration: number;
  cols: number;
  rows: number;
}

const ANSI: (keyof Theme)[] = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
];

const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, "0")}`;

/** Resolve a wterm colour (palette index 0–255, 256 = default, or packed RGB) to CSS. */
export function resolveColor(index: number, rgb: number | undefined, theme: Theme): string | null {
  if (rgb !== undefined) return hex(rgb);
  if (index === 256) return null;
  if (index < 16) return theme[ANSI[index]!] as string;
  if (index < 232) {
    const n = index - 16;
    const r = Math.floor(n / 36) * 51;
    const g = (Math.floor(n / 6) % 6) * 51;
    const b = (n % 6) * 51;
    return hex((r << 16) | (g << 8) | b);
  }
  const level = (index - 232) * 10 + 8;
  return hex((level << 16) | (level << 8) | level);
}

function toGridCell(cell: CellData, theme: Theme): GridCell {
  let fg = resolveColor(cell.fg, cell.fgRgb, theme);
  let bg = resolveColor(cell.bg, cell.bgRgb, theme);
  if (cell.flags & FLAG.reverse) {
    [fg, bg] = [bg ?? theme.background, fg ?? theme.foreground];
  }
  const text = cell.chars ?? (cell.char === 0 ? " " : String.fromCodePoint(cell.char));
  return { text, width: cell.width === 2 ? 2 : 1, fg, bg, flags: cell.flags & ~FLAG.reverse };
}

interface ScreenSnapshot {
  rows: Map<number, GridCell[]>;
  /** Content fingerprint: identical screens share a key, so identical frames are deduplicated. */
  key: string;
}

function snapshot(core: TerminalCore, theme: Theme): ScreenSnapshot {
  const rows = new Map<number, GridCell[]>();
  const keyParts: string[] = [];
  const cols = core.getCols();
  for (let y = 0; y < core.getRows(); y++) {
    const cells: GridCell[] = [];
    let meaningful = false;
    for (let x = 0; x < cols; x++) {
      const raw = core.getCell(y, x);
      if (raw.width === 0) continue;
      const cell = toGridCell(raw, theme);
      if (cell.text !== " " || cell.bg !== null || cell.flags & (FLAG.underline | FLAG.strike)) meaningful = true;
      cells.push(cell);
    }
    if (meaningful) {
      rows.set(y, cells);
      keyParts.push(`${y}:${cells.map((c) => `${c.text}${c.fg ?? ""}${c.bg ?? ""}${c.flags}`).join("")}`);
    }
  }
  return { rows, key: keyParts.join("\n") };
}

/**
 * Replay the visible timeline into a headless core and return de-duplicated grid snapshots with hold durations.
 * This is the shared source for vector/text exporters (SVG, and anything else that doesn't need pixels).
 */
export async function replayFrames(rec: Recording, config: ResolvedConfig): Promise<GridReplay> {
  const core = await loadCore(config.core);
  core.init(rec.header.width, rec.header.height);

  const timeline = buildTimeline(rec.events, config.playbackSpeed);
  const osc = themeOsc(config.theme);
  const events = config.core === "lite" ? timeline.events : withReinjection(timeline.events, osc);
  if (config.core !== "lite") core.writeString(osc);

  const fps = config.fps;
  const totalFrames = Math.max(1, Math.ceil(timeline.duration * fps) + 1);
  const frames: GridFrame[] = [];
  let pointer = 0;
  let lastKey: string | null = null;

  for (let i = 0; i < totalFrames; i++) {
    const time = i / fps;
    while (pointer < events.length && events[pointer]!.vt <= time + 1e-9) {
      const e = events[pointer++]!;
      if (e.type === "o") core.writeString(e.data);
      else if (e.type === "r") {
        const [c, r] = e.data.split("x").map(Number);
        if (c! > 0 && r! > 0) core.resize(c!, r!);
      }
    }
    const cursor = core.getCursor();
    const { rows, key } = snapshot(core, config.theme);
    const fullKey = `${key}|${cursor.row},${cursor.col},${cursor.visible}|${core.getCols()}x${core.getRows()}`;
    if (fullKey === lastKey && frames.length > 0) {
      frames[frames.length - 1]!.hold += 1 / fps;
      continue;
    }
    lastKey = fullKey;
    frames.push({ time, hold: 1 / fps, cols: core.getCols(), rows: core.getRows(), rows_: rows, cursor });
  }

  return { frames, duration: totalFrames / fps, cols: rec.header.width, rows: rec.header.height };
}
