import path from "node:path";
import { USER_PROMPT_PATTERN } from "./promptguess";
import { toMs } from "./duration";
import { applyPreset } from "./presets";
import { resolveTheme } from "./themes";
import type { ResolvedConfig, VideoConfig, ThemeName, Theme } from "./types";

export const DEFAULT_FONT_FAMILY =
  '"JetBrains Mono", "JetBrainsMono Nerd Font Mono", "Fira Code", Menlo, Consolas, "DejaVu Sans Mono", monospace';

/** Split a CSS font-family list into names (quotes removed). */
export function fontFamilies(list: string): string[] {
  return (list.match(/"[^"]*"|'[^']*'|[^,]+/g) ?? []).map((f) => f.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
}

const quoteFamily = (name: string): string => (/[^\w-]/.test(name) && !/^(monospace|sans-serif|serif|system-ui)$/.test(name) ? `"${name}"` : name);

/**
 * The font list the renderer uses. Terminals fall back to a symbols font for glyphs the main font lacks —
 * Ghostty ships Nerd Font symbols and uses them without being told — so the renderer does the same: after the
 * configured families come the Nerd Font variants of the first one, the Nerd symbols fonts, then the defaults.
 * Fallbacks only ever fill glyphs the earlier fonts do not have; they never change how the main font renders.
 */
export function fontStack(family: string): string {
  const configured = fontFamilies(family);
  const first = configured[0] ?? "";
  const nerd = /nerd font/i.test(first)
    ? []
    : [`${first} Nerd Font Mono`, `${first.replace(/\s+/g, "")} Nerd Font Mono`, `${first} Nerd Font`, `${first.replace(/\s+/g, "")} Nerd Font`];
  const all = [...configured, ...(first ? nerd : []), "Symbols Nerd Font Mono", "Symbols Nerd Font", ...fontFamilies(DEFAULT_FONT_FAMILY)];
  const seen = new Set<string>();
  return all
    .filter((f) => {
      const key = f.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map(quoteFamily)
    .join(", ");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function defaultPromptPattern(prompt: string): RegExp {
  return new RegExp(`${escapeRegExp(prompt.trimEnd())}\\s*$`);
}

/** Size of one terminal cell in CSS pixels. */
export interface CellSize {
  w: number;
  h: number;
}

/** Approximate cell size before anything is measured (JetBrains Mono / Menlo are ~0.6em wide). */
export function estimateCell(font: { size: number; lineHeight: number; letterSpacing: number }): CellSize {
  return { w: Math.round(font.size * 0.6 * 100) / 100 + font.letterSpacing, h: Math.ceil(font.size * font.lineHeight) };
}

export const WINDOW_BAR_HEIGHT = 36;

export function resolveConfig(input: VideoConfig): ResolvedConfig {
  const config = applyPreset(input);
  const outputs = Array.isArray(config.output) ? config.output : [config.output];
  if (outputs.length === 0) throw new Error("config.output must name at least one output");

  const prompt = config.prompt ?? "> ";
  // "auto" is resolved later, against the terminal tcut runs in (applyTerminalLook); until then the defaults stand.
  const auto = { theme: config.theme === "auto", font: config.font === "auto" };
  const theme = resolveTheme(auto.theme ? undefined : (config.theme as ThemeName | Theme | undefined));
  const fontConfig = config.font === "auto" ? undefined : config.font;

  const font = {
    family: fontConfig?.family ?? DEFAULT_FONT_FAMILY,
    size: fontConfig?.size ?? 20,
    lineHeight: fontConfig?.lineHeight ?? 1.2,
    letterSpacing: fontConfig?.letterSpacing ?? 0,
  };
  const padding = config.padding ?? 24;
  const shadow = config.shadow
    ? {
        x: (config.shadow === true ? undefined : config.shadow.x) ?? 0,
        y: (config.shadow === true ? undefined : config.shadow.y) ?? 18,
        blur: (config.shadow === true ? undefined : config.shadow.blur) ?? 50,
        color: (config.shadow === true ? undefined : config.shadow.color) ?? "#000000",
        opacity: (config.shadow === true ? undefined : config.shadow.opacity) ?? 0.45,
      }
    : undefined;
  // A shadow needs room around the window; give it some unless the margin was set explicitly.
  const margin = config.margin ?? (shadow ? 40 : 0);
  const wm = config.watermark === undefined ? undefined : config.watermark instanceof Object ? config.watermark : { text: config.watermark };
  const watermark = wm
    ? {
        ...(wm.text !== undefined && { text: wm.text }),
        ...(wm.image !== undefined && { image: wm.image }),
        position: wm.position ?? "bottom-right",
        opacity: wm.opacity ?? 0.6,
        size: wm.size ?? (wm.image ? 28 : 14),
        color: wm.color ?? theme.foreground,
        margin: wm.margin ?? 16,
      }
    : undefined;
  if (watermark && !watermark.text && !watermark.image) throw new Error("watermark needs `text` or `image`");
  const bar = (config.windowBar ?? "none") === "none" ? 0 : WINDOW_BAR_HEIGHT;
  const cell = estimateCell(font);
  let cols = config.cols;
  let rows = config.rows;
  if (config.width !== undefined && cols === undefined) cols = Math.max(10, Math.floor((config.width - 2 * margin - 2 * padding) / cell.w));
  if (config.height !== undefined && rows === undefined) rows = Math.max(3, Math.floor((config.height - 2 * margin - 2 * padding - bar) / cell.h));
  const first = outputs[0]!;
  const castDefault = first.endsWith("/")
    ? path.join(first, "session.cast")
    : first.replace(/\.[^./]+$/, "") + ".cast";

  return {
    output: outputs,
    cast: config.cast ?? castDefault,
    shell: config.shell ?? "bash",
    prompt,
    promptPattern: (config.promptPattern ?? (config.shell === "user" ? new RegExp(USER_PROMPT_PATTERN) : defaultPromptPattern(prompt))).source,
    cwd: config.cwd ?? process.cwd(),
    env: config.env ?? {},
    cols: cols ?? 80,
    rows: rows ?? 24,
    ...(config.width !== undefined && { width: config.width }),
    ...(config.height !== undefined && { height: config.height }),
    ...(config.loopOffset !== undefined && { loopOffset: config.loopOffset }),
    ...(config.maxPause !== undefined && { maxPause: toMs(config.maxPause) / 1000 }),
    ...(config.keys && {
      keys: {
        position: (config.keys === true ? undefined : config.keys.position) ?? "bottom",
        ttl: toMs(config.keys === true ? undefined : config.keys.ttl, 1200),
        merge: toMs(config.keys === true ? undefined : config.keys.merge, 350),
        limit: (config.keys === true ? undefined : config.keys.limit) ?? 1,
        font: (config.keys === true ? undefined : config.keys.font) ?? Math.max(15, Math.round(font.size * 0.9)),
        color: (config.keys === true ? undefined : config.keys.color) ?? "#fff",
        background: (config.keys === true ? undefined : config.keys.background) ?? "rgba(15, 15, 20, 0.85)",
        radius: (config.keys === true ? undefined : config.keys.radius) ?? 8,
      },
    }),
    fps: config.fps ?? 60,
    typingSpeed: toMs(config.typingSpeed, 50),
    typingJitter: Math.min(1, Math.max(0, config.typingJitter ?? 0)),
    seed: config.seed ?? 1,
    playbackSpeed: config.playbackSpeed ?? 1,
    waitTimeout: toMs(config.waitTimeout, 15_000),
    endPause: toMs(config.endPause, 1000),
    quantize: config.quantize ?? false,
    core: config.core ?? "ghostty",
    cache: config.cache ?? true,
    requires: config.requires ?? [],
    font,
    theme,
    auto,
    cursor: {
      blink: config.cursor?.blink ?? true,
      period: config.cursor?.period ?? 1000,
    },
    ...(config.browser && {
      browser: {
        url: config.browser.url,
        title: config.browser.title,
        width: config.browser.width ?? 720,
        height: config.browser.height ?? 0,
        fps: config.browser.fps ?? 10,
        position: config.browser.position ?? "right",
        ...(config.browser.offset && { offset: config.browser.offset }),
      },
    }),
    padding,
    margin,
    marginFill: config.marginFill ?? theme.background,
    ...(shadow && { shadow }),
    ...(watermark && { watermark }),
    borderRadius: config.borderRadius ?? 0,
    windowBar: config.windowBar ?? "none",
    title: config.title ?? "",
  };
}

/** Apply partial user overrides on top of an already-resolved config (used by `render --theme …`). */
export function applyOverrides(base: ResolvedConfig, overrides: Partial<VideoConfig> | undefined): ResolvedConfig {
  if (!overrides) return base;
  const merged: VideoConfig = {
    ...base,
    promptPattern: new RegExp(base.promptPattern),
    // ResolvedConfig keeps maxPause in seconds; VideoConfig reads bare numbers as milliseconds.
    maxPause: base.maxPause === undefined ? undefined : base.maxPause * 1000,
    ...overrides,
    font: overrides.font === "auto" ? "auto" : { ...base.font, ...overrides.font },
    cursor: { ...base.cursor, ...overrides.cursor },
    output: overrides.output ?? base.output,
  };
  // marginFill should follow a new theme unless explicitly set
  if (overrides.theme && !overrides.marginFill) delete (merged as Partial<VideoConfig>).marginFill;
  const resolved = resolveConfig(merged);
  if (!overrides.cast) resolved.cast = base.cast;
  return resolved;
}
