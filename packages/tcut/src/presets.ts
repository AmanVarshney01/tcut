import type { VideoConfig } from "./types";

export type PresetName = "readme" | "x" | "youtube" | "square";

/** Opinionated bundles applied *under* whatever the config sets explicitly. */
export const presets = {
  // Small, loops well, reads at README width.
  readme: { cols: 80, rows: 20, fps: 30, font: { size: 18 }, padding: 20, margin: 0, borderRadius: 8, windowBar: "none", typingSpeed: "40ms" },
  // 16:9 at the size X/Twitter serves without downscaling.
  x: { width: 1280, height: 720, fps: 30, font: { size: 20 }, padding: 24, margin: 24, borderRadius: 12, windowBar: "colorful", typingSpeed: "35ms", typingJitter: 0.3 },
  // Full HD, smooth.
  youtube: { width: 1920, height: 1080, fps: 60, font: { size: 26 }, padding: 32, margin: 40, borderRadius: 14, windowBar: "colorful", typingSpeed: "35ms", typingJitter: 0.3 },
  // 1:1 for feeds.
  square: { width: 1080, height: 1080, fps: 30, font: { size: 22 }, padding: 24, margin: 32, borderRadius: 14, windowBar: "colorful", typingSpeed: "35ms" },
} satisfies Record<PresetName, Partial<VideoConfig>>;

export const presetNames = Object.keys(presets) as PresetName[];

export function applyPreset(config: VideoConfig): VideoConfig {
  if (!config.preset) return config;
  const base = presets[config.preset];
  if (!base) throw new Error(`Unknown preset "${config.preset}". Available: ${presetNames.join(", ")}`);
  return { ...base, ...config, font: { ...base.font, ...config.font } };
}
