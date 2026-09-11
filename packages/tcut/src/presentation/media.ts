import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";
import { MARKER } from "../markers";
import { buildTimeline } from "../timeline";
import { render } from "../renderer/webview";
import { findEncoder } from "../renderer/encoder";
import { presentationSteps, type PresentationManifest } from "./model";
import type { Recording, ResolvedConfig } from "../types";

export interface PrepareOptions {
  directory: string;
  title?: string;
  force?: boolean;
  onProgress?: (message: string) => void;
}
export interface PreparedPresentation { directory: string; manifest: PresentationManifest; cached: boolean }

export async function runFfmpeg(binary: string, args: string[], signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted();
  const proc = Bun.spawn([binary, "-y", "-v", "error", ...args], { stdout: "ignore", stderr: "pipe", signal });
  const [code, error] = await Promise.all([proc.exited, new Response(proc.stderr).text()]);
  if (code !== 0) throw new Error(`ffmpeg failed (${code}): ${error.slice(-3000)}`);
}

async function encoder(name: string): Promise<string> {
  const found = await findEncoder(name);
  if (!found) throw new Error(`Presentation media needs ffmpeg with ${name} (set TCUT_FFMPEG if necessary)`);
  return found.binary;
}

export async function writeJson(file: string, value: PresentationManifest): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.${crypto.randomUUID()}.tmp`;
  await Bun.write(temp, JSON.stringify(value, null, 2) + "\n");
  await rename(temp, file);
}

/** Prepare immutable clips once; presenting never executes the source script. */
export async function preparePresentation(rec: Recording, config: ResolvedConfig, opts: PrepareOptions): Promise<PreparedPresentation> {
  const directory = path.resolve(opts.directory);
  const hash = new Bun.CryptoHasher("sha256");
  hash.update(JSON.stringify({ pipeline: 1, rec: { header: rec.header, events: rec.events }, config, title: opts.title }));
  const files = new Set(rec.events.filter((e) => e[1] === "b").map((e) => path.resolve(rec.source ? path.dirname(rec.source) : process.cwd(), e[2])));
  if (config.watermark?.image) files.add(path.resolve(config.watermark.image));
  for (const file of files) hash.update(await Bun.file(file).arrayBuffer());
  const id = hash.digest("hex");
  const sourceDir = path.join(directory, "sources", id);
  const manifestFile = path.join(sourceDir, "presentation.json");
  const currentFile = path.join(directory, "presentation.json");
  if (!opts.force && await Bun.file(manifestFile).exists()) {
    let manifest = await Bun.file(manifestFile).json() as PresentationManifest;
    if (await Bun.file(currentFile).exists()) {
      const current = await Bun.file(currentFile).json() as PresentationManifest;
      if (current.id === id) manifest = current;
    }
    const assets = ["source.mp4", ...manifest.steps.flatMap((s) => [s.clip, s.poster])];
    if ((await Promise.all(assets.map((file) => Bun.file(path.join(sourceDir, file)).exists()))).every(Boolean)) {
      await writeJson(currentFile, manifest);
      return { directory, manifest, cached: true };
    }
  }
  await mkdir(path.join(directory, "sources"), { recursive: true });
  const stage = await mkdtemp(path.join(directory, "sources", ".prepare-"));
  try {
    const binary = await encoder("libx264");
    opts.onProgress?.("Rendering the reusable source video");
    const safeRec = { ...rec, events: rec.events.filter((e) => !(e[1] === "m" && e[2].startsWith(MARKER.screenshot))) };
    const result = await render(safeRec, { ...config, output: [path.join(stage, "source.mp4")] });
    const timeline = buildTimeline(rec.events, config.playbackSpeed, { maxPause: config.maxPause });
    const steps = presentationSteps(timeline.events, timeline.duration, config.fps);
    for (const [i, step] of steps.entries()) {
      opts.onProgress?.(`Preparing step ${i + 1}/${steps.length}: ${step.title}`);
      await runFfmpeg(binary, ["-i", path.join(stage, "source.mp4"), "-vf", `trim=start_frame=${Math.round(step.start * config.fps)}:end_frame=${Math.round(step.end * config.fps)},setpts=PTS-STARTPTS`, "-an", "-c:v", "libx264", "-preset", "fast", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart", path.join(stage, step.clip)]);
      await runFfmpeg(binary, ["-i", path.join(stage, step.clip), "-frames:v", "1", path.join(stage, step.poster)]);
    }
    const metadata = await new Bun.Image(await Bun.file(path.join(stage, steps[0]!.poster)).bytes()).metadata();
    const manifest: PresentationManifest = { version: 1, id, title: opts.title ?? "Terminal walkthrough", fps: config.fps, width: metadata.width, height: metadata.height, duration: result.durationSeconds, steps };
    await writeJson(path.join(stage, "presentation.json"), manifest);
    // A successful revision already on disk is immutable; forced preparation replaces it only after all work succeeds.
    if (await Bun.file(manifestFile).exists()) await rm(sourceDir, { recursive: true, force: true });
    await rename(stage, sourceDir);
    await writeJson(currentFile, manifest);
    return { directory, manifest, cached: false };
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
