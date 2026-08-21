import path from "node:path";
import { toMs } from "./duration";
import { applyPreset } from "./presets";
import { resolveTheme } from "./themes";
import type { ResolvedConfig, VideoConfig } from "./types";

export const DEFAULT_FONT_FAMILY =
  '"JetBrains Mono", "JetBrainsMono Nerd Font Mono", "Fira Code", Menlo, Consolas, "DejaVu Sans Mono", monospace';

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function defaultPromptPattern(prompt: string): RegExp {
  return new RegExp(`${escapeRegExp(prompt.trimEnd())}\\s*$`);
}

/** Approximate cell size before anything is measured (JetBrains Mono / Menlo are ~0.6em wide). */
export function estimateCell(font: { size: number; lineHeight: number; letterSpacing: number }): { w: number; h: number } {
  return { w: Math.round(font.size * 0.6 * 100) / 100 + font.letterSpacing, h: Math.ceil(font.size * font.lineHeight) };
}

export const WINDOW_BAR_HEIGHT = 36;

export function resolveConfig(input: VideoConfig): ResolvedConfig {
  const config = applyPreset(input);
  const outputs = Array.isArray(config.output) ? config.output : [config.output];
  if (outputs.length === 0) throw new Error("config.output must name at least one output");

  const prompt = config.prompt ?? "> ";
  const theme = resolveTheme(config.theme);

  const font = {
    family: config.font?.family ?? DEFAULT_FONT_FAMILY,
    size: config.font?.size ?? 20,
    lineHeight: config.font?.lineHeight ?? 1.2,
    letterSpacing: config.font?.letterSpacing ?? 0,
  };
  const padding = config.padding ?? 24;
  const margin = config.margin ?? 0;
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
    promptPattern: (config.promptPattern ?? defaultPromptPattern(prompt)).source,
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
    font,
    theme,
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
    ...overrides,
    font: { ...base.font, ...overrides.font },
    cursor: { ...base.cursor, ...overrides.cursor },
    output: overrides.output ?? base.output,
  };
  // marginFill should follow a new theme unless explicitly set
  if (overrides.theme && !overrides.marginFill) delete (merged as Partial<VideoConfig>).marginFill;
  const resolved = resolveConfig(merged);
  if (!overrides.cast) resolved.cast = base.cast;
  return resolved;
}
