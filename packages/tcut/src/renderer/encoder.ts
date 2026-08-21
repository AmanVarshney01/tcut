import type { FileSink, Subprocess } from "bun";
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export interface FrameSink {
  frame(png: Uint8Array): Promise<void>;
  finish(): Promise<void>;
  readonly target: string;
  /** True for outputs that loop (GIF, WebP) — `loopOffset` applies to these. */
  readonly loops?: boolean;
}

type Format = "mp4" | "webm" | "gif" | "webp" | "png-sequence" | "png" | "jpeg";

export function detectFormat(output: string): Format {
  if (output.endsWith("/")) return "png-sequence";
  const ext = path.extname(output).toLowerCase();
  switch (ext) {
    case ".mp4":
      return "mp4";
    case ".webm":
      return "webm";
    case ".gif":
      return "gif";
    case ".webp":
      return "webp";
    case ".png":
      return "png";
    case ".jpg":
    case ".jpeg":
      return "jpeg";
    case "":
      return "png-sequence";
    default:
      throw new Error(`Unsupported output "${output}". Use .mp4, .webm, .gif, .webp, .svg, .html, .png, .jpg or a directory path ending in "/".`);
  }
}

/** Still image of the final frame. PNG is written as-is; JPEG is transcoded with Bun.Image (no ffmpeg). */
class StillSink implements FrameSink {
  private last: Uint8Array | null = null;

  constructor(
    readonly target: string,
    private format: "png" | "jpeg",
  ) {}

  async frame(png: Uint8Array): Promise<void> {
    this.last = png;
  }

  async finish(): Promise<void> {
    if (!this.last) throw new Error(`No frames were rendered for ${this.target}`);
    if (this.format === "png") {
      await Bun.write(this.target, this.last);
      return;
    }
    await new Bun.Image(this.last).jpeg({ quality: 92 }).write(this.target);
  }
}

/**
 * ffmpeg binaries to try, in order: an explicit override, whatever is on PATH, then Homebrew's keg-only
 * `ffmpeg-full` (the regular Homebrew formula dropped libwebp and friends in 9.x).
 */
function ffmpegCandidates(): string[] {
  const list = [
    process.env.TCUT_FFMPEG,
    Bun.which("ffmpeg"),
    "/opt/homebrew/opt/ffmpeg-full/bin/ffmpeg",
    "/usr/local/opt/ffmpeg-full/bin/ffmpeg",
  ].filter((p): p is string => p !== undefined && p !== null && p.length > 0);
  return [...new Set(list)];
}

const encoderLists = new Map<string, Promise<Set<string>>>();

/** Names of encoders a given ffmpeg binary supports (cached per process). Empty set if it can't be run. */
export function ffmpegEncoders(binary: string): Promise<Set<string>> {
  let cached = encoderLists.get(binary);
  if (!cached) {
    cached = (async () => {
      const names = new Set<string>();
      try {
        const proc = Bun.spawn([binary, "-hide_banner", "-encoders"], { stdout: "pipe", stderr: "ignore" });
        const text = await new Response(proc.stdout).text();
        for (const line of text.split("\n")) {
          const m = /^\s*[A-Z.]{6}\s+(\S+)/.exec(line);
          if (m) names.add(m[1]!);
        }
      } catch {
        /* not runnable */
      }
      return names;
    })();
    encoderLists.set(binary, cached);
  }
  return cached;
}

export interface EncoderMatch {
  binary: string;
  encoder: string;
}

/** First ffmpeg binary (see `ffmpegCandidates`) that has one of the candidate encoders. */
export async function findEncoder(...candidates: string[]): Promise<EncoderMatch | null> {
  for (const binary of ffmpegCandidates()) {
    if (!(await Bun.file(binary).exists())) continue;
    const available = await ffmpegEncoders(binary);
    const encoder = candidates.find((c) => available.has(c));
    if (encoder) return { binary, encoder };
  }
  return null;
}

export async function hasEncoder(...candidates: string[]): Promise<string | null> {
  return (await findEncoder(...candidates))?.encoder ?? null;
}

type FfmpegFormat = Exclude<Format, "png-sequence" | "png" | "jpeg">;

const REQUIRED_ENCODERS = {
  mp4: { candidates: ["libx264"], hint: "an ffmpeg build with libx264" },
  webm: { candidates: ["libvpx-vp9"], hint: "an ffmpeg build with libvpx" },
  gif: { candidates: ["gif"], hint: "an ffmpeg build with the gif encoder" },
  webp: { candidates: ["libwebp_anim", "libwebp"], hint: "an ffmpeg build with libwebp (Homebrew: `brew install ffmpeg-full`)" },
} satisfies Record<FfmpegFormat, { candidates: string[]; hint: string }>;

async function requireEncoder(format: FfmpegFormat, output: string): Promise<EncoderMatch> {
  const { candidates, hint } = REQUIRED_ENCODERS[format];
  const found = await findEncoder(...candidates);
  if (!found) {
    throw new Error(
      `Cannot write ${output}: no ffmpeg with a ${candidates.join("/")} encoder was found (looked at ${ffmpegCandidates().join(", ")}). Install ${hint}, or point TCUT_FFMPEG at a suitable binary.`,
    );
  }
  return found;
}

export interface Chapter {
  title: string;
  /** Start time, seconds. */
  start: number;
}

/** ffmpeg metadata file with [CHAPTER] blocks (milliseconds timebase). */
export function chaptersMetadata(chapters: Chapter[], durationSeconds: number): string {
  const lines = [";FFMETADATA1"];
  chapters.forEach((ch, i) => {
    const start = Math.round(ch.start * 1000);
    const end = Math.round((chapters[i + 1]?.start ?? durationSeconds) * 1000);
    lines.push("[CHAPTER]", "TIMEBASE=1/1000", `START=${start}`, `END=${Math.max(end, start + 1)}`, `title=${ch.title.replace(/[\\=;#\n]/g, " ")}`);
  });
  return lines.join("\n") + "\n";
}

function ffmpegArgs(format: Format, fps: number, output: string, encoder: string, metadataFile?: string): string[] {
  const input = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "pipe:0"];
  if (metadataFile && format === "mp4") input.push("-i", metadataFile, "-map_metadata", "1");
  const evenSize = "scale=trunc(iw/2)*2:trunc(ih/2)*2";
  switch (format) {
    case "mp4":
      return [
        ...input,
        "-vf", evenSize,
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "medium",
        "-crf", "18",
        "-movflags", "+faststart",
        output,
      ];
    case "webm":
      return [...input, "-vf", evenSize, "-c:v", "libvpx-vp9", "-pix_fmt", "yuv420p", "-b:v", "0", "-crf", "30", "-row-mt", "1", output];
    case "gif": {
      const gifFps = Math.min(fps, 50);
      return [
        ...input,
        "-vf",
        `fps=${gifFps},split[a][b];[a]palettegen=stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle`,
        "-loop", "0",
        output,
      ];
    }
    case "webp":
      return [...input, "-c:v", encoder, "-lossless", "0", "-q:v", "85", "-loop", "0", "-preset", "text", output];
    default:
      throw new Error(`No ffmpeg pipeline for ${format}`);
  }
}

class FfmpegSink implements FrameSink {
  private proc: Subprocess<"pipe", "ignore", "pipe">;
  private stdin: FileSink;
  private stderr: Promise<string>;
  readonly loops: boolean;

  constructor(
    readonly target: string,
    format: Format,
    fps: number,
    match: EncoderMatch,
    metadataFile?: string,
  ) {
    this.loops = format === "gif" || format === "webp";
    this.proc = Bun.spawn([match.binary, ...ffmpegArgs(format, fps, target, match.encoder, metadataFile)], { stdin: "pipe", stdout: "ignore", stderr: "pipe" });
    this.stdin = this.proc.stdin;
    this.stderr = new Response(this.proc.stderr).text();
  }

  async frame(png: Uint8Array): Promise<void> {
    this.stdin.write(png);
    await this.stdin.flush();
  }

  async finish(): Promise<void> {
    await this.stdin.end();
    const code = await this.proc.exited;
    if (code !== 0) {
      const err = (await this.stderr).trim();
      throw new Error(`ffmpeg exited with code ${code} while writing ${this.target}${err ? `:\n${err}` : ""}`);
    }
  }
}

class PngSequenceSink implements FrameSink {
  private index = 0;
  private pending: Promise<unknown>[] = [];

  constructor(readonly target: string) {}

  async frame(png: Uint8Array): Promise<void> {
    const file = path.join(this.target, `frame-${String(this.index++).padStart(6, "0")}.png`);
    this.pending.push(Bun.write(file, png));
    if (this.pending.length >= 32) {
      await Promise.all(this.pending);
      this.pending = [];
    }
  }

  async finish(): Promise<void> {
    await Promise.all(this.pending);
  }
}

export async function ensureFfmpeg(): Promise<void> {
  for (const binary of ffmpegCandidates()) {
    if (await Bun.file(binary).exists()) return;
  }
  throw new Error(
    "ffmpeg not found. Install it (brew install ffmpeg / apt install ffmpeg), set TCUT_FFMPEG, or use an output that needs no ffmpeg (.svg, .html, .png, or a frames/ directory).",
  );
}

export async function createSinks(outputs: string[], fps: number, opts: { chapters?: Chapter[]; durationSeconds?: number } = {}): Promise<FrameSink[]> {
  const sinks: FrameSink[] = [];
  let metadataFile: string | undefined;
  if (opts.chapters && opts.chapters.length > 0) {
    metadataFile = path.join(tmpdir(), `tcut-chapters-${process.pid}-${Math.random().toString(36).slice(2)}.txt`);
    await Bun.write(metadataFile, chaptersMetadata(opts.chapters, opts.durationSeconds ?? 0));
  }
  for (const output of outputs) {
    const format = detectFormat(output);
    if (format === "png-sequence") {
      await mkdir(output, { recursive: true });
      sinks.push(new PngSequenceSink(output));
      continue;
    }
    if (format === "png" || format === "jpeg") {
      await mkdir(path.dirname(path.resolve(output)), { recursive: true });
      sinks.push(new StillSink(output, format));
      continue;
    }
    await ensureFfmpeg();
    const match = await requireEncoder(format as FfmpegFormat, output);
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    sinks.push(new FfmpegSink(output, format, fps, match, metadataFile));
  }
  return sinks;
}
