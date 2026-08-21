import type { ResolvedConfig, Theme } from "../types";

const BAR_HEIGHT = 36;
/** Gap between the terminal window and the browser window. */
export const BROWSER_GAP = 16;
/** Height of the browser window's chrome bar. */
export const BROWSER_BAR = 34;

export function barHeight(config: ResolvedConfig): number {
  return config.windowBar === "none" ? 0 : BAR_HEIGHT;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function windowBarHtml(config: ResolvedConfig): string {
  const { windowBar, title } = config;
  if (windowBar === "none") return "";
  const right = windowBar.endsWith("Right");
  const rings = windowBar.startsWith("rings");
  const dot = (color: string) =>
    `<span class="dot" style="${rings ? `border:2px solid ${color}` : `background:${color}`}"></span>`;
  const dots = `<div class="dots">${dot("#ff5f57")}${dot("#febc2e")}${dot("#28c840")}</div>`;
  const titleHtml = `<div class="title">${escapeHtml(title)}</div>`;
  return `<div id="bar" class="${right ? "right" : ""}">${right ? titleHtml + dots : dots + titleHtml}</div>`;
}

const ANSI_ORDER: (keyof Theme)[] = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
];

function themeCssVars(theme: Theme): string {
  const vars = [
    `--term-fg:${theme.foreground}`,
    `--term-bg:${theme.background}`,
    `--term-cursor:${theme.cursor ?? theme.foreground}`,
    ...ANSI_ORDER.map((key, i) => `--term-color-${i}:${theme[key]}`),
  ];
  return vars.join(";");
}

function toOscRgb(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  if (!m) throw new Error(`Theme colours must be #RRGGBB, got "${hex}"`);
  return `rgb:${m[1]}/${m[2]}/${m[3]}`;
}

/**
 * OSC 4/10/11/12 sequences that push the theme into the emulator, so colours Ghostty resolves itself
 * (palette indices → fgRgb) match the CSS variables.
 */
export function themeOsc(theme: Theme): string {
  const BEL = "\x07";
  let s = "";
  ANSI_ORDER.forEach((key, i) => {
    s += `\x1b]4;${i};${toOscRgb(theme[key]!)}${BEL}`;
  });
  s += `\x1b]10;${toOscRgb(theme.foreground)}${BEL}`;
  s += `\x1b]11;${toOscRgb(theme.background)}${BEL}`;
  s += `\x1b]12;${toOscRgb(theme.cursor ?? theme.foreground)}${BEL}`;
  return s;
}

/** HTML shell for the renderer page. The bundled module attaches `window.__vt`. */
export function renderHtml(config: ResolvedConfig): string {
  const { font, theme } = config;
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="/wterm.css">
<style>
  html, body { margin: 0; padding: 0; background: ${config.marginFill}; overflow: hidden; }
  #stage {
    position: absolute;
    left: ${config.margin}px; top: ${config.margin}px;
    display: flex; align-items: stretch; gap: ${BROWSER_GAP}px;
    flex-direction: ${{ right: "row", left: "row-reverse", bottom: "column", top: "column-reverse", overlay: "row" }[config.browser?.position ?? "right"]};
  }
  ${
    config.browser?.position === "overlay"
      ? `#stage { display: block; }
  #stage #frame { position: absolute; left: 0; top: 0; z-index: 2; box-shadow: 0 18px 50px rgba(0,0,0,0.45); }
  #stage #browser { position: absolute; z-index: 1; box-shadow: 0 18px 50px rgba(0,0,0,0.45); }
  #stage.front-browser #browser { z-index: 3; }
  #stage.front-browser #frame { z-index: 1; }`
      : ""
  }
  #browser {
    width: ${config.browser && (config.browser.position === "top" || config.browser.position === "bottom") ? "auto" : `${config.browser?.width ?? 0}px`};
    height: ${config.browser && (config.browser.position === "top" || config.browser.position === "bottom") ? `${config.browser.height || 480}px` : "auto"};
    flex: none;
    background: #ffffff;
    border-radius: ${config.borderRadius}px;
    overflow: hidden;
    display: ${config.browser ? "flex" : "none"};
    flex-direction: column;
    box-sizing: border-box;
  }
  #browser-bar {
    height: ${BROWSER_BAR}px; flex: none;
    display: flex; align-items: center; gap: 8px; padding: 0 12px;
    background: #e9e9ec; color: #444; font: 12px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  #browser-bar .bdot { width: 11px; height: 11px; border-radius: 50%; display: inline-block; }
  #browser-url {
    flex: 1; margin-left: 8px; background: #fff; border-radius: 6px; padding: 3px 10px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-align: center; color: #333;
  }
  #bframe { display: block; width: 100%; flex: 1; object-fit: cover; object-position: top; background: #fff; }
  #frame {
    position: relative;
    background: ${theme.background};
    border-radius: ${config.borderRadius}px;
    --pad-x: ${config.padding}px;
    --pad-y: ${config.padding}px;
    padding: var(--pad-y) var(--pad-x);
    box-sizing: border-box;
    overflow: hidden;
  }
  #bar {
    height: ${barHeight(config)}px;
    margin: calc(var(--pad-y) * -1) calc(var(--pad-x) * -1) 0;
    padding: 0 14px;
    background: ${theme.background};
    display: flex; align-items: center; justify-content: space-between;
    font: 13px -apple-system, "Segoe UI", Helvetica, Arial, sans-serif;
    color: ${theme.foreground};
  }
  #bar .dots { display: flex; gap: 8px; }
  #bar .dot { width: 12px; height: 12px; border-radius: 50%; box-sizing: border-box; display: inline-block; }
  #bar .title { flex: 1; text-align: center; opacity: 0.7; }
  #bar.right .title { text-align: left; }
  #term.wterm {
    ${themeCssVars(theme)};
    --term-font-family: ${font.family};
    --term-font-size: ${font.size}px;
    --term-line-height: ${font.lineHeight};
    --term-row-height: ${Math.ceil(font.size * font.lineHeight)}px;
    letter-spacing: ${font.letterSpacing}px;
    padding: 0; border-radius: 0; box-shadow: none; background: transparent;
    overflow: hidden;
  }
  #term .term-row { overflow: hidden; }
  /* Key overlay: chips for recent key presses, driven by the renderer on the render clock. */
  #keys {
    position: absolute; left: 0; right: 0; ${config.keys?.position === "top" ? "top" : "bottom"}: ${Math.max(10, config.padding - 6)}px;
    display: ${config.keys ? "flex" : "none"}; justify-content: center; gap: 6px; pointer-events: none; z-index: 5;
  }
  #keys span {
    font: 600 ${config.keys?.font ?? 15}px ${font.family};
    color: ${config.keys?.color ?? "#fff"}; background: ${config.keys?.background ?? "rgba(15, 15, 20, 0.85)"};
    border: 1px solid rgba(255,255,255,0.12); border-radius: ${config.keys?.radius ?? 8}px;
    padding: 0.4em 0.9em; letter-spacing: 0.02em; white-space: pre;
    box-shadow: 0 6px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08);
  }
  /* Zoom: the terminal grid is scaled inside its frame; the renderer sets the transform per frame.
     The frame clips it so magnified content never spills over the bar or the rounded corners. */
  #zoom { transform-origin: 0 0; will-change: transform; }
  #frame { overflow: hidden; }
  #frame > *:not(#zoom):not(#keys) { position: relative; z-index: 2; }
</style>
<style id="blink"></style>
</head>
<body>
<div id="stage">
<div id="frame">
  ${windowBarHtml(config)}
  <div id="zoom"><div id="term"></div></div>
  <div id="keys"></div>
</div>
${
  config.browser
    ? `<div id="browser">
  <div id="browser-bar">
    <span class="bdot" style="background:#ff5f57"></span><span class="bdot" style="background:#febc2e"></span><span class="bdot" style="background:#28c840"></span>
    <span id="browser-url">${escapeHtml(config.browser.title ?? config.browser.url ?? "")}</span>
  </div>
  <img id="bframe" alt="" />
</div>`
    : ""
}
</div>
<script type="module" src="/app.js"></script>
</body>
</html>`;
}
