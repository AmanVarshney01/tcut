import { mkdir } from "node:fs/promises";
import path from "node:path";
import { readCast, writeCast } from "./cast";
import { applyOverrides, resolveConfig } from "./config";
import { record } from "./recorder";
import { renderOutputs, type RenderResult } from "./render";
import type { RecordOptions, Recording, RenderOptions, ResolvedConfig, Script, VideoConfig } from "./types";

export interface VideoRecordOptions extends RecordOptions {
  /** Re-record even if a cached cast matches. */
  force?: boolean;
}

export interface RunOptions extends VideoRecordOptions, RenderOptions {
  /** Skip rendering; only write the .cast. */
  recordOnly?: boolean;
}

export interface RunResult extends RenderResult {
  cast: string;
  recording: Recording;
  /** True when the cast was reused from cache instead of re-recorded. */
  cached: boolean;
}

/** Config keys that affect what gets recorded (render-only keys are excluded from the cache key). */
const RECORD_KEYS: (keyof ResolvedConfig)[] = [
  "shell", "prompt", "promptPattern", "cwd", "env", "cols", "rows", "fps",
  "typingSpeed", "typingJitter", "seed", "waitTimeout", "endPause", "quantize", "core",
];

export class Video {
  readonly config: ResolvedConfig;
  readonly script: Script;
  readonly __bunVideo = true as const;
  /** Absolute path of the script file, when loaded by the CLI; enables cast caching. */
  source: string | undefined;

  constructor(config: VideoConfig, script: Script) {
    this.config = resolveConfig(config);
    this.script = script;
  }

  /** SHA-256 of the script source + record-relevant config. Undefined when the source path is unknown. */
  async scriptHash(): Promise<string | undefined> {
    if (!this.source) return undefined;
    const file = Bun.file(this.source);
    if (!(await file.exists())) return undefined;
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(await file.arrayBuffer());
    const subset: Record<string, unknown> = {};
    for (const key of RECORD_KEYS) subset[key] = this.config[key];
    hasher.update(JSON.stringify(subset));
    return hasher.digest("hex");
  }

  /** Returns the cached recording if the cast on disk was produced from an identical script + record config. */
  async cachedRecording(): Promise<Recording | undefined> {
    if (!this.config.cache) return undefined;
    const hash = await this.scriptHash();
    if (!hash) return undefined;
    const file = Bun.file(this.config.cast);
    if (!(await file.exists())) return undefined;
    try {
      const rec = await readCast(this.config.cast);
      return rec.header.scriptHash === hash ? rec : undefined;
    } catch {
      return undefined;
    }
  }

  /** Drive the PTY and return the recording (also saved to `config.cast`). Uses the cache unless `force`. */
  async record(opts: VideoRecordOptions = {}): Promise<Recording & { cached?: boolean }> {
    if (!opts.force) {
      const cached = await this.cachedRecording();
      if (cached) {
        opts.log?.(`reusing ${this.config.cast} (script unchanged; pass --force to re-record)`);
        return { ...cached, cached: true };
      }
    }
    const recording = await record(this.config, this.script, opts);
    recording.header.scriptHash = await this.scriptHash();
    await mkdir(path.dirname(path.resolve(this.config.cast)), { recursive: true });
    await writeCast(this.config.cast, recording);
    return recording;
  }

  /** Render a recording (defaults to the saved .cast) to the configured outputs. */
  async render(recording?: Recording, opts: RenderOptions = {}): Promise<RenderResult> {
    const rec = recording ?? (await readCast(this.config.cast));
    const config = applyOverrides(this.config, opts.overrides);
    return renderOutputs(rec, config, opts.onProgress);
  }

  async run(opts: RunOptions = {}): Promise<RunResult> {
    const recording = await this.record(opts);
    const cached = recording.cached === true;
    if (opts.recordOnly) {
      return { recording, cached, cast: this.config.cast, outputs: [], frames: 0, screenshots: [], durationSeconds: recording.header.duration ?? 0 };
    }
    const result = await this.render(recording, opts);
    return { ...result, recording, cached, cast: this.config.cast };
  }
}

/** Define a video. Export it as the default export and run it with `tcut <file>`. */
export function defineVideo(config: VideoConfig, script: Script): Video {
  return new Video(config, script);
}

export function isVideo(value: unknown): value is Video {
  return typeof value === "object" && value !== null && (value as { __bunVideo?: unknown }).__bunVideo === true;
}

/** Render an existing .cast file (from tcut or asciinema) with the given settings. */
export async function renderCast(
  castFile: string,
  overrides: Partial<VideoConfig> & { output?: string | string[] },
  onProgress?: RenderOptions["onProgress"],
): Promise<RenderResult> {
  const rec = await readCast(castFile);
  const base =
    rec.header.bunVideo ??
    resolveConfig({ output: overrides.output ?? castFile.replace(/\.cast$/, "") + ".mp4", cols: rec.header.width, rows: rec.header.height });
  const config = applyOverrides(base, overrides);
  return renderOutputs(rec, config, onProgress);
}
