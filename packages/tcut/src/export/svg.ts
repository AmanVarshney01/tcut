import { fitFrame } from "../loop";
import { barHeight } from "../renderer/page";
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

function windowBar(config: ResolvedConfig, g: Geometry): string {
  if (config.windowBar === "none") return "";
  const rings = config.windowBar.startsWith("rings");
  const right = config.windowBar.endsWith("Right");
  const y = g.frameY + Math.max(8, config.padding - 12) + 12;
  const colors = ["#ff5f57", "#febc2e", "#28c840"];
  const startX = right ? g.frameX + g.frameW - config.padding - 6 - 40 : g.frameX + config.padding + 6;
  const dots = colors
    .map((c, i) => `<circle cx="${num(startX + i * 20)}" cy="${num(y)}" r="6" ${rings ? `fill="none" stroke="${c}" stroke-width="2"` : `fill="${c}"`}/>`)
    .join("");
  const title = config.title
    ? `<text x="${num(g.frameX + g.frameW / 2)}" y="${num(y + 4)}" text-anchor="middle" font-family="-apple-system, Segoe UI, Helvetica, Arial, sans-serif" font-size="13" fill="${config.theme.foreground}" opacity="0.7">${esc(config.title)}</text>`
    : "";
  return dots + title;
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

    // Text runs with identical style
    const spans: string[] = [];
    x = 0;
    let run: { x: number; text: string; style: string } | null = null;
    for (const cell of cells) {
      const blank = cell.text === " " && !(cell.flags & (FLAG.underline | FLAG.strike));
      const style = blank ? "" : styleAttrs(cell, theme.foreground);
      if (run && (run.style === style || (blank && run.text.length > 0))) {
        run.text += cell.text;
      } else {
        if (run && run.text.trim()) spans.push(`<tspan x="${num(run.x * g.cellW)}"${run.style}>${esc(run.text.replace(/\s+$/, ""))}</tspan>`);
        run = blank ? null : { x, text: cell.text, style };
      }
      x += cell.width;
    }
    if (run && run.text.trim()) spans.push(`<tspan x="${num(run.x * g.cellW)}"${run.style}>${esc(run.text.replace(/\s+$/, ""))}</tspan>`);
    if (spans.length) parts.push(`<text y="${num(y * g.cellH + baseline)}">${spans.join("")}</text>`);
  }

  if (frame.cursor.visible && frame.cursor.row < frame.rows && frame.cursor.col < frame.cols) {
    parts.push(`<rect x="${num(frame.cursor.col * g.cellW)}" y="${num(frame.cursor.row * g.cellH)}" width="${num(g.cellW)}" height="${num(g.cellH)}" fill="${theme.cursor ?? theme.foreground}" opacity="0.85"/>`);
  }
  return parts.join("");
}

export interface SvgResult {
  svg: string;
  frames: number;
  duration: number;
}

/** Animated SVG: a horizontal strip of unique frames moved by a stepped CSS animation. No JS, no fonts embedded. */
export async function buildSvg(rec: Recording, config: ResolvedConfig): Promise<SvgResult> {
  const replay = await replayFrames(rec, config);
  const g = svgGeometry(config, replay.cols, replay.rows);
  const { theme, font } = config;
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

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${g.width}" height="${g.height}" viewBox="0 0 ${g.width} ${g.height}" font-family="${esc(font.family)}" font-size="${font.size}">
<style>
.strip{animation:tcut ${num(total)}s steps(1,end) infinite}
@keyframes tcut{${keyframes.join("")}}
text{white-space:pre;dominant-baseline:auto}
</style>
<rect width="100%" height="100%" fill="${config.marginFill}"/>
<rect x="${num(g.frameX)}" y="${num(g.frameY)}" width="${num(g.frameW)}" height="${num(g.frameH)}" rx="${config.borderRadius}" fill="${theme.background}"/>
${windowBar(config, g)}
<clipPath id="term"><rect x="${num(g.termX)}" y="${num(g.termY)}" width="${num(g.termW)}" height="${num(g.termH)}"/></clipPath>
<g clip-path="url(#term)"><g transform="translate(${num(g.termX)} ${num(g.termY)})"><g class="strip" xml:space="preserve">
${frames}
</g></g></g>
</svg>
`;
  return { svg, frames: n, duration: total };
}

export async function writeSvg(rec: Recording, config: ResolvedConfig, file: string): Promise<SvgResult> {
  const result = await buildSvg(rec, config);
  await Bun.write(file, result.svg);
  return result;
}
