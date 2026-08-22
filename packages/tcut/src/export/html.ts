import { mkdir } from "node:fs/promises";
import { PIN_CSS } from "../renderer/pin";
import path from "node:path";
import { barHeight, embedImage, shadowCss, watermarkCss } from "../renderer/page";
import { pageAssets } from "../renderer/bundle";
import { buildTimeline } from "../timeline";
import type { Recording, ResolvedConfig, Theme } from "../types";

const ANSI_ORDER: (keyof Theme)[] = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
];

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function windowBar(config: ResolvedConfig): string {
  if (config.windowBar === "none") return "";
  const rings = config.windowBar.startsWith("rings");
  const right = config.windowBar.endsWith("Right");
  const dot = (c: string) => `<span class="dot" style="${rings ? `border:2px solid ${c}` : `background:${c}`}"></span>`;
  const dots = `<div class="dots">${dot("#ff5f57")}${dot("#febc2e")}${dot("#28c840")}</div>`;
  const title = `<div class="title">${escapeHtml(config.title === "auto" ? "" : config.title)}</div>`;
  return `<div id="bar" class="${right ? "right" : ""}">${right ? title + dots : dots + title}</div>`;
}

/** Single-file HTML player: cast + theme + lite core + controls. Works from file://. */
export async function buildHtml(rec: Recording, config: ResolvedConfig): Promise<string> {
  const assets = await pageAssets();
  const { events, duration } = buildTimeline(rec.events, config.playbackSpeed);
  const { theme, font } = config;
  const wm = config.watermark;
  const watermark = wm ? `<div id="watermark">${wm.image ? `<img src="${(await embedImage(wm.image)).dataUri}" alt="">` : escapeHtml(wm.text ?? "")}</div>` : "";
  const data = {
    cols: rec.header.width,
    rows: rec.header.height,
    duration,
    speed: 1,
    autoTitle: config.title === "auto",
    events: events.filter((e) => e.type === "o" || e.type === "r").map(({ vt, type, data }) => ({ vt, type, data })),
  };
  // "</script>" inside the JSON would terminate the data block; escape it.
  const json = JSON.stringify(data).replace(/<\//g, "<\\/");
  const vars = [
    `--term-fg:${theme.foreground}`,
    `--term-bg:${theme.background}`,
    `--term-cursor:${theme.cursor ?? theme.foreground}`,
    ...ANSI_ORDER.map((k, i) => `--term-color-${i}:${theme[k]}`),
  ].join(";");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(config.title || "tcut recording")}</title>
<style>
${assets.css}
html, body { margin: 0; background: ${config.marginFill}; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
#frame { position: relative; display: inline-block; background: ${theme.background}; border-radius: ${config.borderRadius}px; padding: ${config.padding}px; margin: ${config.margin}px; box-shadow: ${shadowCss(config) ?? "0 12px 40px rgba(0,0,0,.35)"}; }
${watermarkCss(config)}
#bar { height: ${barHeight(config)}px; margin-top: -${Math.min(config.padding, 12)}px; display: flex; align-items: center; justify-content: space-between; font: 13px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: ${theme.foreground}; }
#bar .dots { display: flex; gap: 8px; } #bar .dot { width: 12px; height: 12px; border-radius: 50%; box-sizing: border-box; display: inline-block; }
#bar .title { flex: 1; text-align: center; opacity: .7; } #bar.right .title { text-align: left; }
#term.wterm { ${vars}; --term-font-family: ${font.family}; --term-font-size: ${font.size}px; --term-line-height: ${font.lineHeight}; --term-row-height: ${Math.ceil(font.size * font.lineHeight)}px; letter-spacing: ${font.letterSpacing}px; --vt-letter-spacing: ${font.letterSpacing}px; padding: 0; border-radius: 0; box-shadow: none; background: transparent; cursor: pointer; }
${PIN_CSS}
#controls { display: flex; gap: 12px; align-items: center; margin-top: 12px; font: 12px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif; color: ${theme.foreground}; opacity: .85; }
#controls button { background: transparent; color: inherit; border: 1px solid currentColor; border-radius: 6px; width: 34px; height: 26px; cursor: pointer; }
#controls input[type=range] { flex: 1; accent-color: ${theme.cursor ?? theme.foreground}; }
#controls label { display: flex; gap: 4px; align-items: center; }
</style>
</head>
<body>
<div id="frame">
  ${windowBar(config)}
  ${watermark}
  <div id="term"></div>
  <div id="controls">
    <button id="play" title="Play / pause">▶</button>
    <input id="progress" type="range" min="0" max="1000" value="0">
    <span id="time">0:00</span>
    <label><input id="loop" type="checkbox" checked> loop</label>
  </div>
</div>
<script type="application/json" id="tcut-cast">${json}</script>
<script type="module">${assets.playerJs}</script>
</body>
</html>`;
}

export async function writeHtml(rec: Recording, config: ResolvedConfig, file: string): Promise<void> {
  await mkdir(path.dirname(path.resolve(file)), { recursive: true });
  await Bun.write(file, await buildHtml(rec, config));
}
