import path from "node:path";
import { toMs } from "./duration";
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

export function resolveConfig(config: VideoConfig): ResolvedConfig {
  const outputs = Array.isArray(config.output) ? config.output : [config.output];
  if (outputs.length === 0) throw new Error("config.output must name at least one output");

  const prompt = config.prompt ?? "> ";
  const theme = resolveTheme(config.theme);
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
    cols: config.cols ?? 80,
    rows: config.rows ?? 24,
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
    font: {
      family: config.font?.family ?? DEFAULT_FONT_FAMILY,
      size: config.font?.size ?? 20,
      lineHeight: config.font?.lineHeight ?? 1.2,
      letterSpacing: config.font?.letterSpacing ?? 0,
    },
    theme,
    cursor: {
      blink: config.cursor?.blink ?? true,
      period: config.cursor?.period ?? 1000,
    },
    padding: config.padding ?? 24,
    margin: config.margin ?? 0,
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
