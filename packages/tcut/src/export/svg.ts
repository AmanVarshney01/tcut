import { mkdir } from "node:fs/promises";
import { fontStack } from "../config";
import path from "node:path";
import { fitFrame } from "../loop";
import { barHeight, embedImage } from "../renderer/page";
import type { Recording, ResolvedConfig } from "../types";
import { FLAG, replayFrames, type GridCell, type GridFrame } from "./frames";

const esc = (s: string) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ""));

interface Geometry {
  cellW: number;
  cellH: number;
  termW: number;
  termH: number;
  frameX: number;
  frameY: number;
  frameW: number;
  frameH: number;
  termX: number;
  termY: number;
  width: number;
  height: number;
}

export function svgGeometry(config: ResolvedConfig, cols: number, rows: number): Geometry {
  const cellW = Math.round(config.font.size * 0.6 * 100) / 100 + config.font.letterSpacing;
  const cellH = Math.ceil(config.font.size * config.font.lineHeight);
  const termW = cols * cellW;
  const termH = rows * cellH;
  const bar = barHeight(config);
  const fit = fitFrame({
    termW: Math.ceil(termW),
    termH,
    padding: config.padding,
    margin: config.margin,
    bar,
    width: config.width,
    height: config.height,
  });
  return {
    cellW,
    cellH,
    termW,
    termH,
    frameX: config.margin,
    frameY: config.margin,
    frameW: fit.frameW,
    frameH: fit.frameH,
    termX: config.margin + fit.padX,
    termY: config.margin + fit.padY + bar,
    width: fit.width,
    height: fit.height,
  };
}

function windowBar(config: ResolvedConfig, g: Geometry, title: string): string {
  if (config.windowBar === "none") return "";
  const rings = config.windowBar.startsWith("rings");
  const right = config.windowBar.endsWith("Right");
  const y = g.frameY + Math.max(8, config.padding - 12) + 12;
  const colors = ["#ff5f57", "#febc2e", "#28c840"];
  const startX = right ? g.frameX + g.frameW - config.padding - 6 - 40 : g.frameX + config.padding + 6;
  const dots = colors
    .map((c, i) => `<circle cx="${num(startX + i * 20)}" cy="${num(y)}" r="6" ${rings ? `fill="none" stroke="${c}" stroke-width="2"` : `fill="${c}"`}/>`)
    .join("");
  const titleText = title
    ? `<text x="${num(g.frameX + g.frameW / 2)}" y="${num(y + 4)}" text-anchor="middle" font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="13" fill="${config.theme.foreground}" opacity="0.7">${esc(title)}</text>`
    : "";
  return dots + titleText;
}

function styleAttrs(cell: GridCell, defaultFg: string): string {
  let a = ` fill="${cell.fg ?? defaultFg}"`;
  if (cell.flags & FLAG.bold) a += ' font-weight="bold"';
  if (cell.flags & FLAG.italic) a += ' font-style="italic"';
  if (cell.flags & FLAG.dim) a += ' opacity="0.6"';
  const deco = [cell.flags & FLAG.underline ? "underline" : "", cell.flags & FLAG.strike ? "line-through" : ""].filter(Boolean).join(" ");
  if (deco) a += ` text-decoration="${deco}"`;
  return a;
}

function frameMarkup(frame: GridFrame, config: ResolvedConfig, g: Geometry): string {
  const parts: string[] = [];
  const { theme } = config;
  const baseline = Math.round(g.cellH * 0.78 * 100) / 100;

  for (const [y, cells] of frame.rows_) {
    // Background runs
    let x = 0;
    let runStart = 0;
    let runBg: string | null = null;
    const flushBg = (end: number) => {
      if (runBg) parts.push(`<rect x="${num(runStart * g.cellW)}" y="${num(y * g.cellH)}" width="${num((end - runStart) * g.cellW)}" height="${num(g.cellH)}" fill="${runBg}"/>`);
    };
    for (const cell of cells) {
      if (cell.bg !== runBg) {
        flushBg(x);
        runStart = x;
        runBg = cell.bg;
      }
      x += cell.width;
    }
    flushBg(x);

    // Text runs with identical style (and link); OSC 8 links become real <a> elements
    const spans: string[] = [];
    x = 0;
    let run: { x: number; text: string; style: string; link: string | null; cols: number[]; single: boolean } | null = null;
    const flushRun = () => {
      if (!run || !run.text.trim()) return;
      const text = run.text.replace(/\s+$/, "");
      // Fallback-font glyphs are not one cell wide; give every glyph its own x when the run has any non-ASCII
      // and each cell is a single code point (an x list addresses code points, so clusters would misalign).
      const pinned = run.single && /[^\x20-\x7e]/.test(text);
      const xAttr = pinned ? run.cols.slice(0, [...text].length).map((c) => num(c * g.cellW)).join(" ") : num(run.x * g.cellW);
      const span = `<tspan x="${xAttr}"${run.style}>${esc(text)}</tspan>`;
      spans.push(run.link ? `<a href="${esc(run.link)}">${span}</a>` : span);
    };
    for (const cell of cells) {
      const blank = cell.text === " " && !(cell.flags & (FLAG.underline | FLAG.strike));
      const style = blank ? "" : styleAttrs(cell, theme.foreground);
      const single = [...cell.text].length === 1;
      if (run && ((run.style === style && run.link === cell.link) || (blank && run.text.length > 0 && run.link === null))) {
        run.text += cell.text;
        run.cols.push(x);
        run.single &&= single;
      } else {
        flushRun();
        run = blank ? null : { x, text: cell.text, style, link: cell.link, cols: [x], single };
      }
      x += cell.width;
    }
    flushRun();
    if (spans.length) parts.push(`<text y="${num(y * g.cellH + baseline)}">${spans.join("")}</text>`);
  }

  if (frame.cursor.visible && frame.cursor.row < frame.rows && frame.cursor.col < frame.cols) {
    parts.push(`<rect x="${num(frame.cursor.col * g.cellW)}" y="${num(frame.cursor.row * g.cellH)}" width="${num(g.cellW)}" height="${num(g.cellH)}" fill="${theme.cursor ?? theme.foreground}" opacity="0.85"/>`);
  }
  return parts.join("");
}

/** Drop shadow as an SVG filter on the window rect (blur radius ≈ 2 × stdDeviation). */
function shadowDefs(config: ResolvedConfig, id: string): string {
  const s = config.shadow;
  if (!s) return "";
  return `<defs><filter id="${id}" x="-40%" y="-40%" width="180%" height="200%"><feDropShadow dx="${num(s.x)}" dy="${num(s.y)}" stdDeviation="${num(s.blur / 2)}" flood-color="${s.color}" flood-opacity="${num(s.opacity)}"/></filter></defs>`;
}

/**
 * Element ids must be unique per HTML document, and a page may inline several tcut SVGs (a README with a demo
 * and a few stills): a shared `#term` clip would resolve to whichever came first. The tag is derived from the
 * content, so the same recording still renders byte-identically.
 */
const idTag = (content: string): string => Bun.hash(content).toString(36).slice(0, 7);

async function watermarkMarkup(config: ResolvedConfig, g: Geometry): Promise<string> {
  const w = config.watermark;
  if (!w) return "";
  const m = w.margin;
  const anchor = w.position === "center" ? "middle" : w.position.endsWith("left") ? "start" : "end";
  const x = w.position === "center" ? g.width / 2 : w.position.endsWith("left") ? m : g.width - m;
  if (w.image) {
    const img = await embedImage(w.image);
    const h = w.size;
    const iw = img.height > 0 ? (img.width / img.height) * h : h;
    const ix = anchor === "start" ? x : anchor === "end" ? x - iw : x - iw / 2;
    const iy = w.position === "center" ? g.height / 2 - h / 2 : w.position.startsWith("top") ? m : g.height - m - h;
    return `<image href="${img.dataUri}" x="${num(ix)}" y="${num(iy)}" width="${num(iw)}" height="${num(h)}" opacity="${num(w.opacity)}"/>`;
  }
  const y = w.position === "center" ? g.height / 2 : w.position.startsWith("top") ? m + w.size : g.height - m;
  const baseline = w.position === "center" ? ' dominant-baseline="middle"' : "";
  return `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}"${baseline} font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-weight="500" font-size="${num(w.size)}" fill="${w.color}" opacity="${num(w.opacity)}">${esc(w.text ?? "")}</text>`;
}

export interface SvgResult {
  svg: string;
  frames: number;
  duration: number;
}

/** The shared document: chrome (background, window, bar, watermark) around exporter-supplied style + body. */
async function svgDocument(config: ResolvedConfig, g: Geometry, title: string, style: string, body: string): Promise<string> {
  const { theme, font } = config;
  const tag = idTag(body);
  const ids = { term: `term-${tag}`, shadow: `shadow-${tag}` };
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}" font-family="${esc(fontStack(font.family))}" font-size="${font.size}">
<style>
${style.replaceAll("@@tag@@", tag)}text{white-space:pre;dominant-baseline:auto}
</style>
${config.marginFill === "transparent" ? "" : `<rect width="100%" height="100%" fill="${config.marginFill}"/>`}
${shadowDefs(config, ids.shadow)}
<rect x="${num(g.frameX)}" y="${num(g.frameY)}" width="${num(g.frameW)}" height="${num(g.frameH)}" rx="${config.borderRadius}" fill="${theme.background}"${config.shadow ? ` filter="url(#${ids.shadow})"` : ""}/>
${windowBar(config, g, title)}
<clipPath id="${ids.term}"><rect x="${num(g.termX)}" y="${num(g.termY)}" width="${num(g.termW)}" height="${num(g.termH)}"/></clipPath>
<g clip-path="url(#${ids.term})"><g transform="translate(${num(g.termX)} ${num(g.termY)})">${body}</g></g>
${await watermarkMarkup(config, g)}
</svg>
`;
}

/** Animated SVG: a horizontal strip of unique frames moved by a stepped CSS animation. No JS, no fonts embedded. */
export async function buildSvg(rec: Recording, config: ResolvedConfig): Promise<SvgResult> {
  const replay = await replayFrames(rec, config);
  const g = svgGeometry(config, replay.cols, replay.rows);
  const n = replay.frames.length;
  const total = replay.duration;

  const keyframes: string[] = [];
  for (let i = 0; i < n; i++) {
    const pct = (replay.frames[i]!.time / total) * 100;
    keyframes.push(`${num(pct)}%{transform:translateX(${num(-i * g.termW)}px)}`);
  }
  keyframes.push(`100%{transform:translateX(${num(-(n - 1) * g.termW)}px)}`);

  const frames = replay.frames
    .map((f, i) => `<g transform="translate(${num(i * g.termW)} 0)">${frameMarkup(f, config, g)}</g>`)
    .join("\n");

  const style = `.strip{animation:tcut-@@tag@@ ${num(total)}s steps(1,end) infinite}\n@keyframes tcut-@@tag@@{${keyframes.join("")}}\n`;
  const body = `<g class="strip" xml:space="preserve">\n${frames}\n</g>`;
  const title = config.title === "auto" ? (replay.title ?? "") : config.title;
  return { svg: await svgDocument(config, g, title, style, body), frames: n, duration: total };
}

export interface SnapshotMark {
  file: string;
  /** Seconds on the visible timeline. */
  at: number;
}

/** The frame on screen at `at` seconds (frames carry their start time; the last one started before `at` wins). */
function frameAt(frames: GridFrame[], at: number): GridFrame | undefined {
  let current = frames[0];
  for (const f of frames) {
    if (f.time <= at + 1e-9) current = f;
    else break;
  }
  return current;
}

/** Static (non-animated) SVG stills for `t.snapshot("x.svg")` marks — one replay serves all of them. */
export async function writeSvgSnapshots(rec: Recording, config: ResolvedConfig, marks: SnapshotMark[]): Promise<string[]> {
  const replay = await replayFrames(rec, config);
  const g = svgGeometry(config, replay.cols, replay.rows);
  const title = config.title === "auto" ? (replay.title ?? "") : config.title;
  const written: string[] = [];
  for (const mark of marks) {
    // The raster pass applies output and marks that share a frame tick together; match that: the mark
    // captures the first tick at or after its instant, so output recorded just before it is included.
    const tick = Math.ceil(mark.at * config.fps - 1e-6) / config.fps;
    const frame = frameAt(replay.frames, tick);
    if (!frame) continue;
    const svg = await svgDocument(config, g, title, "", `<g xml:space="preserve">${frameMarkup(frame, config, g)}</g>`);
    await mkdir(path.dirname(path.resolve(mark.file)), { recursive: true });
    await Bun.write(mark.file, svg);
    written.push(mark.file);
  }
  return written;
}

export async function writeSvg(rec: Recording, config: ResolvedConfig, file: string): Promise<SvgResult> {
  const result = await buildSvg(rec, config);
  await Bun.write(file, result.svg);
  return result;
}
