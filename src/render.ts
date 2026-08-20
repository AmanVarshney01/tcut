import { mkdir } from "node:fs/promises";
import path from "node:path";
import { writeHtml } from "./export/html";
import { writeSvg } from "./export/svg";
import { render as renderRaster, type RenderResult } from "./renderer/webview";
import type { Recording, RenderProgress, ResolvedConfig } from "./types";

export type { RenderResult };

const kind = (output: string): "svg" | "html" | "raster" => {
  if (output.endsWith("/")) return "raster";
  const ext = path.extname(output).toLowerCase();
  if (ext === ".svg") return "svg";
  if (ext === ".html" || ext === ".htm") return "html";
  return "raster";
};

/**
 * Fan the configured outputs out to the right backend: `.svg` and `.html` are produced from the headless core
 * (no WebView, no ffmpeg); everything else goes through the WebView + ffmpeg renderer in one pass.
 */
export async function renderOutputs(
  rec: Recording,
  config: ResolvedConfig,
  onProgress?: (p: RenderProgress) => void,
): Promise<RenderResult> {
  const svg = config.output.filter((o) => kind(o) === "svg");
  const html = config.output.filter((o) => kind(o) === "html");
  const raster = config.output.filter((o) => kind(o) === "raster");

  const result: RenderResult = { outputs: [], frames: 0, screenshots: [], durationSeconds: 0 };

  for (const file of svg) {
    await mkdir(path.dirname(path.resolve(file)), { recursive: true });
    const r = await writeSvg(rec, config, file);
    result.outputs.push(file);
    result.frames = Math.max(result.frames, r.frames);
    result.durationSeconds = r.duration;
  }
  for (const file of html) {
    await writeHtml(rec, config, file);
    result.outputs.push(file);
  }
  if (raster.length > 0) {
    const r = await renderRaster(rec, { ...config, output: raster }, onProgress);
    result.outputs.push(...r.outputs);
    result.frames = r.frames;
    result.screenshots.push(...r.screenshots);
    result.durationSeconds = r.durationSeconds;
  }
  return result;
}
