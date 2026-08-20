#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { writeCast } from "./cast";
import { resolveConfig } from "./config";
import * as api from "./index";
import { recordLive } from "./live";
import { ensurePublicBucket, loadPublishConfig, publicUrlFor, publishFiles, savePublishConfig, type PublishConfig } from "./publish";
import { renderOutputs } from "./render";
import { generateScript } from "./scriptgen";
import { runScriptTests } from "./testing";
import { findThemes, themeNames } from "./themes";
import type { CoreName, ThemeName, VideoConfig, WindowBar } from "./types";
import { Video, isVideo, renderCast } from "./video";

// Let user scripts `import { defineVideo } from "tcut"` (or "termcut", the npm package name) regardless of
// where they live or whether this is the compiled binary (no node_modules there): resolve the bare specifier
// to this very module graph.
Bun.plugin({
  name: "tcut-self",
  setup(build) {
    for (const specifier of ["tcut", "termcut"]) {
      build.module(specifier, () => ({ exports: { ...api }, loader: "object" }));
    }
  },
});

const HELP = `tcut — script terminal sessions in TypeScript, render them to video.

Usage:
  tcut <script.ts> [options]          record + render
  tcut rec [options] [-- command…]    record a LIVE session you drive yourself (no script), then render
  tcut record <script.ts> [options]   record only (writes the .cast)
  tcut render <file.cast> [options]   render an existing .cast (tcut or asciinema)
  tcut test <path...>                 run scripts in fast mode as tests (no video)
  tcut publish <files...> [--open]    upload to your S3-compatible bucket and print share links
  tcut publish --setup                configure the bucket (RustFS, MinIO, R2, S3 …) — once
  tcut init [name] [--template t]     scaffold a new script (basic | tour | test)
  tcut themes [query]                 list the ~600 bundled themes (Ghostty collection)

Options (override the script's config):
  -o, --output <path>      .mp4 .webm .gif .webp .svg .html .png .jpg or dir/ for PNG frames — repeatable
      --theme <name>       ${themeNames.join(" | ")}
      --font <family>      --font-size <px>  --line-height <x>  --letter-spacing <px>
      --fps <n>            --speed <x>       playback speed multiplier
      --padding <px>       --margin <px>     --margin-fill <css-color>   --radius <px>
      --window-bar <type>  none | colorful | colorfulRight | rings | ringsRight
      --title <text>       --no-blink
      --core <name>        ghostty | lite
      --cols <n> --rows <n>  terminal grid (rec: defaults to your terminal's size)
      --width <px> --height <px>  video size; the grid is derived and centred inside
      --loop-offset <n|N%> where GIF/WebP loops start
      --cast <path>        where to read/write the .cast
      --record-only        stop after writing the cast
      --no-script          rec: don't write the editable <name>.video.ts next to the cast
      --force              ignore the cast cache and re-record
      --open               publish: open the first link in the browser
      --name <file>        publish: object name (default: the file's basename)
      --endpoint --bucket --access-key --secret-key --public-url --region   publish --setup values
      --template <name>    for init: basic | tour | test
  -q, --quiet
  -h, --help
`;

const { values, positionals } = parseArgs({
  args: Bun.argv.slice(2),
  allowPositionals: true,
  options: {
    output: { type: "string", short: "o", multiple: true },
    theme: { type: "string" },
    font: { type: "string" },
    "font-size": { type: "string" },
    "line-height": { type: "string" },
    "letter-spacing": { type: "string" },
    fps: { type: "string" },
    speed: { type: "string" },
    padding: { type: "string" },
    margin: { type: "string" },
    "margin-fill": { type: "string" },
    radius: { type: "string" },
    "window-bar": { type: "string" },
    title: { type: "string" },
    "no-blink": { type: "boolean" },
    core: { type: "string" },
    cols: { type: "string" },
    rows: { type: "string" },
    width: { type: "string" },
    height: { type: "string" },
    "loop-offset": { type: "string" },
    cast: { type: "string" },
    "record-only": { type: "boolean" },
    "no-script": { type: "boolean" },
    force: { type: "boolean" },
    setup: { type: "boolean" },
    open: { type: "boolean" },
    name: { type: "string" },
    endpoint: { type: "string" },
    bucket: { type: "string" },
    "access-key": { type: "string" },
    "secret-key": { type: "string" },
    "public-url": { type: "string" },
    region: { type: "string" },
    template: { type: "string" },
    quiet: { type: "boolean", short: "q" },
    help: { type: "boolean", short: "h" },
  },
});

const quiet = values.quiet === true;
const useColor = process.stdout.isTTY === true && !process.env.NO_COLOR;
const paint = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const green = paint("32");
const dim = paint("2");
const red = paint("31");

// Status goes to stdout (plain informational output); only real errors go to stderr.
const log = (msg: string) => {
  if (!quiet) process.stdout.write(`${msg}\n`);
};

function fail(message: string): never {
  console.error(`${red("error:")} ${message}`);
  process.exit(1);
}

function num(name: keyof typeof values): number | undefined {
  const raw = values[name];
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) fail(`--${String(name)} expects a number, got "${String(raw)}"`);
  return n;
}

function overridesFromFlags(): Partial<VideoConfig> {
  const o: Partial<VideoConfig> = {};
  if (values.output?.length) o.output = values.output;
  if (values.theme) o.theme = values.theme as ThemeName;
  const font: NonNullable<VideoConfig["font"]> = {};
  if (values.font) font.family = values.font;
  if (values["font-size"] !== undefined) font.size = num("font-size");
  if (values["line-height"] !== undefined) font.lineHeight = num("line-height");
  if (values["letter-spacing"] !== undefined) font.letterSpacing = num("letter-spacing");
  if (Object.keys(font).length) o.font = font;
  if (values.fps !== undefined) o.fps = num("fps");
  if (values.speed !== undefined) o.playbackSpeed = num("speed");
  if (values.padding !== undefined) o.padding = num("padding");
  if (values.margin !== undefined) o.margin = num("margin");
  if (values["margin-fill"]) o.marginFill = values["margin-fill"];
  if (values.radius !== undefined) o.borderRadius = num("radius");
  if (values["window-bar"]) o.windowBar = values["window-bar"] as WindowBar;
  if (values.title !== undefined) o.title = values.title;
  if (values["no-blink"]) o.cursor = { blink: false };
  if (values.core) {
    if (values.core !== "ghostty" && values.core !== "lite") fail("--core must be ghostty or lite");
    o.core = values.core as CoreName;
  }
  if (values.cast) o.cast = values.cast;
  if (values.cols !== undefined) o.cols = num("cols");
  if (values.rows !== undefined) o.rows = num("rows");
  if (values.width !== undefined) o.width = num("width");
  if (values.height !== undefined) o.height = num("height");
  if (values["loop-offset"] !== undefined) o.loopOffset = values["loop-offset"];
  return o;
}

async function loadVideo(file: string): Promise<Video> {
  const abs = path.resolve(file);
  if (!(await Bun.file(abs).exists())) fail(`Script not found: ${file}`);
  const mod = (await import(abs)) as { default?: unknown };
  if (!isVideo(mod.default)) {
    fail(`${file} must \`export default defineVideo({...}, async (t) => {...})\``);
  }
  const video = mod.default;
  video.source = abs;
  const overrides = overridesFromFlags();
  if (Object.keys(overrides).length === 0) return video;
  const merged = new Video(
    {
      ...video.config,
      promptPattern: new RegExp(video.config.promptPattern),
      ...overrides,
      font: { ...video.config.font, ...overrides.font },
      cursor: { ...video.config.cursor, ...overrides.cursor },
    },
    video.script,
  );
  merged.source = abs;
  return merged;
}

function progressReporter(): (p: { frame: number; total: number }) => void {
  if (quiet || !process.stdout.isTTY) return () => {};
  let last = -1;
  return ({ frame, total }) => {
    const pct = Math.floor((frame / total) * 100);
    if (pct === last && frame !== total) return;
    last = pct;
    process.stdout.write(`\r${dim(`  rendering ${frame}/${total} frames (${pct}%)`)}`);
    if (frame === total) process.stdout.write("\n");
  };
}

async function fileSize(file: string): Promise<string> {
  const f = Bun.file(file);
  if (!(await f.exists())) return "";
  const bytes = f.size;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const ok = (what: string, detail = "") => log(`${green("✔")} ${what}${detail ? ` ${dim(detail)}` : ""}`);

async function reportOutputs(outputs: string[], screenshots: string[]): Promise<void> {
  for (const out of outputs) ok(`wrote ${out}`, await fileSize(out));
  for (const shot of screenshots) ok(`screenshot ${shot}`);
}

const TEMPLATES: Record<string, (name: string) => string> = {
  basic: (name) => `import { defineVideo } from "tcut";

export default defineVideo(
  {
    output: "${name}.mp4",
    theme: "catppuccin-mocha",
    cols: 80,
    rows: 24,
    typingSpeed: "40ms",
  },
  async (t) => {
    await t.run("echo 'Hello from tcut!'");
    await t.sleep("1s");
    await t.type("ls -la");
    await t.sleep("500ms");
    await t.enter();
    await t.wait();
    await t.sleep("2s");
  },
);
`,
  tour: (name) => `import { defineVideo } from "tcut";

export default defineVideo(
  {
    output: ["${name}.mp4", "${name}.gif", "${name}.svg"],
    theme: "tokyo-night",
    cols: 90,
    rows: 24,
    typingSpeed: "35ms",
    typingJitter: 0.3,
    windowBar: "colorful",
    title: "${name}",
    margin: 32,
    borderRadius: 12,
  },
  async (t) => {
    // Setup that happens but is cut from the video.
    await t.hide(async () => {
      await t.run("cd $(mktemp -d) && printf 'alpha\\\\nbeta\\\\n' > notes.txt");
      await t.clear();
    });

    await t.run("ls -la");
    await t.expect(/notes\\.txt/);          // assertion: the script is also a test
    await t.sleep("800ms");

    await t.type("cat notes.txt");
    await t.sleep("400ms");
    await t.enter();
    await t.wait();                         // prompt is back
    await t.screenshot("${name}-notes.png");
    await t.sleep("1.5s");
  },
);
`,
  test: (name) => `import { defineVideo } from "tcut";

// Run with: tcut test ${name}.tcut.ts   (fast mode: no sleeps, no typing delay)
export default defineVideo(
  {
    output: "${name}.mp4",
    shell: "bash",
  },
  async (t) => {
    await t.run("echo $((6 * 7))");
    await t.expect(/^42$/m);

    await t.run("printf 'a\\\\nb\\\\n' | wc -l");
    await t.expect(/2/);

    await t.run("true && echo ok");
    await t.expect(/ok/);
  },
);
`,
};

async function main(): Promise<void> {
  if (values.help || positionals.length === 0) {
    console.log(HELP);
    return;
  }

  const [first, ...rest] = positionals;
  const started = performance.now();
  const elapsed = () => `${((performance.now() - started) / 1000).toFixed(1)}s`;

  switch (first) {
    case "themes": {
      const names = rest[0] ? findThemes(rest[0]) : themeNames;
      if (names.length === 0) fail(`No theme matches "${rest[0]}"`);
      for (const name of names) console.log(name);
      if (!rest[0]) log(dim(`${names.length} themes · use any name with --theme, e.g. --theme "Gruvbox Dark"`));
      return;
    }
    case "publish": {
      if (values.setup) {
        const ask = async (label: string, flag: string | undefined, fallback: string, secret = false): Promise<string> => {
          if (flag) return flag;
          if (!process.stdin.isTTY) return fallback;
          const answer = prompt(`${label}${fallback ? ` [${fallback}]` : ""}:`) ?? "";
          return answer.trim() || fallback;
        };
        const existing = await loadPublishConfig().catch(() => null);
        const cfg: PublishConfig = {
          endpoint: await ask("S3 endpoint", values.endpoint, existing?.endpoint ?? "https://s3.amanv.cloud"),
          bucket: await ask("Bucket", values.bucket, existing?.bucket ?? "tcut"),
          accessKeyId: await ask("Access key", values["access-key"], existing?.accessKeyId ?? ""),
          secretAccessKey: await ask("Secret key", values["secret-key"], existing?.secretAccessKey ?? "", true),
          region: values.region ?? existing?.region ?? "us-east-1",
          ...(values["public-url"] || existing?.publicUrl ? { publicUrl: values["public-url"] ?? existing?.publicUrl } : {}),
        };
        if (!cfg.accessKeyId || !cfg.secretAccessKey) fail("publish --setup needs --access-key and --secret-key (or run it in a terminal to be prompted)");
        const result = await ensurePublicBucket(cfg, log);
        const file = await savePublishConfig(cfg);
        ok(`saved ${file}`, "mode 600");
        ok(`bucket ${cfg.bucket} on ${cfg.endpoint}`, result.bucketCreated ? "created" : "exists");
        if (result.publicReadOk) ok("public read verified", `links will look like ${publicUrlFor(cfg, "x").replace(/\/x$/, "/<hash>/demo.gif")}`);
        else log(`${red("✘")} anonymous read failed — set a public-read policy on the bucket or pass --public-url for a CDN/proxy in front of it`);
        return;
      }
      if (rest.length === 0) fail("publish needs at least one file (or --setup)");
      const cfg = await loadPublishConfig();
      if (!cfg) fail("publish is not configured yet — run `tcut publish --setup` (or set TCUT_S3_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY)");
      const published = await publishFiles(rest, cfg, { name: values.name, log });
      for (const p of published) ok(p.url, dim(path.basename(p.file)));
      if (values.open && published[0]) {
        const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        Bun.spawn([opener, published[published.length - 1]!.url], { stdout: "ignore", stderr: "ignore" });
      }
      return;
    }
    case "init": {
      const name = rest[0] ?? "demo";
      const template = values.template ?? "basic";
      const make = TEMPLATES[template];
      if (!make) fail(`Unknown template "${template}". Available: ${Object.keys(TEMPLATES).join(", ")}`);
      const base = name.replace(/\.(video|tcut)\.ts$|\.ts$/, "");
      const file = name.endsWith(".ts") ? name : template === "test" ? `${base}.tcut.ts` : `${base}.video.ts`;
      if (await Bun.file(file).exists()) fail(`${file} already exists`);
      await Bun.write(file, make(path.basename(base)));
      console.log(`created ${file}\n\nrun it with:\n  ${template === "test" ? `tcut test ${file}` : `tcut ${file}`}`);
      return;
    }
    case "rec": {
      // Live mode: the user (or a pipe) drives the PTY; everything after `--` is the command to run.
      const overrides = overridesFromFlags();
      const rawOutputs = overrides.output ?? ["rec.mp4"];
      const outputs = Array.isArray(rawOutputs) ? rawOutputs : [rawOutputs];
      const config = resolveConfig({ ...overrides, output: outputs, cast: overrides.cast });
      const command = rest.length > 0 ? rest : undefined;
      // Size: --cols/--rows if given, else derived from --width/--height, else the terminal tcut runs in.
      const sized = overrides.width !== undefined || overrides.height !== undefined;
      const recording = await recordLive(config, {
        command,
        log,
        cols: overrides.cols ?? (sized ? config.cols : undefined),
        rows: overrides.rows ?? (sized ? config.rows : undefined),
      });
      await mkdir(path.dirname(path.resolve(config.cast)), { recursive: true });
      await writeCast(config.cast, recording);
      log("");
      ok(`wrote ${config.cast}`, `${recording.events.length} events, ${(recording.header.duration ?? 0).toFixed(1)}s`);
      if (!values["no-script"]) {
        const scriptPath = config.cast.replace(/\.cast$/, "") + ".video.ts";
        await Bun.write(scriptPath, generateScript(recording, { output: outputs, cleanShell: !command, command, castPath: config.cast }));
        ok(`wrote ${scriptPath}`, "editable script — tweak it, then `tcut " + scriptPath + "`");
      }
      if (values["record-only"]) return;
      const result = await renderOutputs(recording, config, progressReporter());
      await reportOutputs(result.outputs, result.screenshots);
      log(dim(`  ${result.frames} frames, ${result.durationSeconds.toFixed(1)}s of video in ${elapsed()}`));
      return;
    }
    case "record": {
      if (!rest[0]) fail("record needs a script file");
      const video = await loadVideo(rest[0]);
      const rec = await video.record({ log, force: values.force });
      ok(`${rec.cached ? "reused" : "wrote"} ${video.config.cast}`, `${rec.events.length} events, ${(rec.header.duration ?? 0).toFixed(1)}s, ${elapsed()}`);
      return;
    }
    case "render": {
      if (!rest[0]) fail("render needs a .cast file");
      const result = await renderCast(rest[0], overridesFromFlags(), progressReporter());
      await reportOutputs(result.outputs, result.screenshots);
      log(dim(`  ${result.frames} frames, ${result.durationSeconds.toFixed(1)}s of video in ${elapsed()}`));
      return;
    }
    case "test": {
      if (rest.length === 0) fail("test needs at least one script file or directory");
      const summary = await runScriptTests(rest, (line) => console.log(line));
      process.exit(summary.failed > 0 ? 1 : 0);
    }
    // eslint-disable-next-line no-fallthrough -- process.exit above never returns
    default: {
      const video = await loadVideo(first!);
      const result = await video.run({ log, force: values.force, recordOnly: values["record-only"], onProgress: progressReporter() });
      ok(`${result.cached ? "reused" : "wrote"} ${result.cast}`);
      await reportOutputs(result.outputs, result.screenshots);
      if (!values["record-only"]) log(dim(`  ${result.frames} frames, ${result.durationSeconds.toFixed(1)}s of video in ${elapsed()}`));
    }
  }
}

main().catch((err: unknown) => {
  console.error(`\nerror: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
