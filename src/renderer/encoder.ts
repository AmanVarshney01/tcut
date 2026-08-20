import type { FileSink, Subprocess } from "bun";
import { mkdir } from "node:fs/promises";
import path from "node:path";

export interface FrameSink {
  frame(png: Uint8Array): Promise<void>;
  finish(): Promise<void>;
  readonly target: string;
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

let encoderList: Promise<Set<string>> | null = null;

/** Names of encoders this ffmpeg build supports (cached per process). */
export function ffmpegEncoders(): Promise<Set<string>> {
  encoderList ??= (async () => {
    const proc = Bun.spawn(["ffmpeg", "-hide_banner", "-encoders"], { stdout: "pipe", stderr: "ignore" });
    const text = await new Response(proc.stdout).text();
    const names = new Set<string>();
    for (const line of text.split("\n")) {
      const m = /^\s*[A-Z.]{6}\s+(\S+)/.exec(line);
      if (m) names.add(m[1]!);
    }
    return names;
  })();
  return encoderList;
}

export async function hasEncoder(...candidates: string[]): Promise<string | null> {
  if (!Bun.which("ffmpeg")) return null;
  const available = await ffmpegEncoders();
  return candidates.find((c) => available.has(c)) ?? null;
}

type FfmpegFormat = Exclude<Format, "png-sequence" | "png" | "jpeg">;

const REQUIRED_ENCODERS: Record<FfmpegFormat, { candidates: string[]; hint: string }> = {
  mp4: { candidates: ["libx264"], hint: "an ffmpeg build with libx264" },
  webm: { candidates: ["libvpx-vp9"], hint: "an ffmpeg build with libvpx" },
  gif: { candidates: ["gif"], hint: "an ffmpeg build with the gif encoder" },
  webp: { candidates: ["libwebp_anim", "libwebp"], hint: "an ffmpeg build with libwebp (e.g. `brew install ffmpeg` full build)" },
};

async function requireEncoder(format: FfmpegFormat, output: string): Promise<string> {
  const { candidates, hint } = REQUIRED_ENCODERS[format];
  const found = await hasEncoder(...candidates);
  if (!found) throw new Error(`Cannot write ${output}: this ffmpeg has no ${candidates.join("/")} encoder. Install ${hint}.`);
  return found;
}

function ffmpegArgs(format: Format, fps: number, output: string, encoder: string): string[] {
  const input = ["-y", "-loglevel", "error", "-f", "image2pipe", "-framerate", String(fps), "-i", "pipe:0"];
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

  constructor(
    readonly target: string,
    format: Format,
    fps: number,
    encoder: string,
  ) {
    this.proc = Bun.spawn(["ffmpeg", ...ffmpegArgs(format, fps, target, encoder)], { stdin: "pipe", stdout: "ignore", stderr: "pipe" });
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
  if (!Bun.which("ffmpeg")) {
    throw new Error(
      "ffmpeg not found on PATH. Install it (brew install ffmpeg / apt install ffmpeg) or render to a PNG sequence (output: \"frames/\").",
    );
  }
}

export async function createSinks(outputs: string[], fps: number): Promise<FrameSink[]> {
  const sinks: FrameSink[] = [];
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
    const encoder = await requireEncoder(format as FfmpegFormat, output);
    await mkdir(path.dirname(path.resolve(output)), { recursive: true });
    sinks.push(new FfmpegSink(output, format, fps, encoder));
  }
  return sinks;
}
