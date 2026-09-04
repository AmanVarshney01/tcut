#!/usr/bin/env bun
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { readCast, writeCast } from "./cast";
import { applyOverrides, resolveConfig } from "./config";
import * as api from "./index";
import { recordLive } from "./live";
import { detectPromptPattern } from "./promptguess";
import { applyTerminalLook } from "./terminallook";
import { throughShell, userShell } from "./usershell";
import { ensurePublicBucket, loadPublishConfig, publicUrlFor, publishFiles, savePublishConfig, type PublishConfig, type Published } from "./publish";
import { diffCasts, type DiffResult } from "./diff";
import { diagnoseCast, formatDoctorReport, type DoctorReport } from "./doctor";
import { toMs } from "./duration";
import { concatRecordings, cutRecording, flattenedConfig, rebaseBrowserFrames, recordingDuration, selectChapters } from "./edit";
import { presetNames, type PresetName } from "./presets";
import { renderOutputs } from "./render";
import { generateScript } from "./scriptgen";
import { runScriptTests, type TestSummary } from "./testing";
import { findThemes, themeNames } from "./themes";
import type { BrowserConfig, ClipSelection, CoreName, Recording, ResolvedConfig, ThemeName, VideoConfig, WindowBar } from "./types";
import { Video, attachBrowserFrames, castConfig, isVideo, renderCast } from "./video";

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
  tcut diff <a.cast> <b.cast>         compare what two recordings show on screen (exit 1 if different)
  tcut doctor <file.cast>             what the program used (Kitty graphics with Ghostty core), and what tcut cannot show (Sixel, iTerm2 images, unknown sequences)
  tcut cut <file.cast> --from 2s --to 10s [--cast out.cast] [-o …]   keep part of a recording (by time or --chapters)
  tcut concat <a.cast> <b.cast…> [--gap 500ms] [--cast out.cast] [-o …]   join recordings end to end
  tcut publish <files...> [--open]    upload to your S3-compatible bucket and print share links
  tcut publish --setup                configure the bucket (RustFS, MinIO, R2, S3 …) — once
  tcut init [name] [--template t]     scaffold a new script (basic | tour | test)
  tcut themes [query]                 list the ~600 bundled themes (Ghostty collection)

Options (override the script's config):
  -o, --output <path>      .mp4 .webm .gif .webp .svg .html .png .jpg or dir/ for PNG frames — repeatable
      --theme <name>       ${themeNames.join(" | ")}
      --font <family>      --font-size <px>  --line-height <x>  --letter-spacing <px>  (--theme auto / --font auto: this terminal's)
      --fps <n>            --speed <x>       playback speed multiplier
      --padding <px>       --margin <px>     --margin-fill <css-color>   --radius <px>
      --window-bar <type>  none | colorful | colorfulRight | rings | ringsRight
      --title <text>       --no-blink
      --core <name>        ghostty | lite
      --cols <n> --rows <n>  terminal grid (rec: defaults to your terminal's size)
      --width <px> --height <px>  video size; the grid is derived and centred inside
      --loop-offset <n|N%> where GIF/WebP loops start
      --max-pause <dur>    idle compression: cap gaps between events (e.g. 800ms)
      --keys               show recent key presses as chips
      --shadow             drop shadow under the window (margin defaults to 40)
      --watermark <text>   text in the bottom-right corner; --watermark-image <file> for a logo
      --from <t> --to <t>  render/cut only this part of the visible timeline (seconds, or "1.5s", "2m")
      --chapters <a,b>     render/cut only these chapters (titles or numbers), joined in that order
      --split-chapters     one output per chapter: demo.mp4 → demo-01-install.mp4 …
      --gap <dur>          concat: still time between parts
      --preset <name>      readme | x | youtube | square
      --browser <url>      rec: record a browser window too (--browser-position right|left|top|bottom|overlay)
      --clean              rec: a clean shell with a plain > prompt instead of your own (also: run -- command bare)
      --raw                rec: run -- command as a bare binary, not through your shell (no aliases/functions)
      --at <seconds>       diff: compare the screen at this time instead of the end
      --images <dir>       diff: also write a.png / b.png
      --cast <path>        where to read/write the .cast
      --record-only        stop after writing the cast
      --no-script          rec: don't write the editable <name>.video.ts next to the cast
      --force              ignore the cast cache and re-record
      --open               publish: open the first link in the browser
      --name <file>        publish: object name (default: the file's basename)
      --endpoint --bucket --access-key --secret-key --public-url --region   publish --setup values
      --template <name>    for init: basic | tour | test
      --json               machine-readable result (or { "error" }) on stdout, nothing else
  -q, --quiet
  -h, --help

Agents: npx skills add AmanVarshney01/tcut   ·   docs: https://tcut.amanv.dev/llms.txt
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
    "max-pause": { type: "string" },
    keys: { type: "boolean" },
    preset: { type: "string" },
    browser: { type: "string" },
    "browser-position": { type: "string" },
    shadow: { type: "boolean" },
    watermark: { type: "string" },
    "watermark-image": { type: "string" },
    from: { type: "string" },
    to: { type: "string" },
    chapters: { type: "string" },
    "split-chapters": { type: "boolean" },
    gap: { type: "string" },
    at: { type: "string" },
    images: { type: "string" },
    cast: { type: "string" },
    "record-only": { type: "boolean" },
    "no-script": { type: "boolean" },
    raw: { type: "boolean" },
    clean: { type: "boolean" },
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
    json: { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

const json = values.json === true;
const quiet = values.quiet === true || json;
interface OutputFile {
  path: string;
  bytes: number;
}

/** Every shape `--json` can print (one document on stdout; failures print `{ error, type }` instead). */
type CliReport =
  | { published: Published[] }
  | { cast: string; script: string | null; events: number; durationSeconds: number }
  | { cast: string; script: string | null; outputs: OutputFile[]; frames: number; durationSeconds: number }
  | { cast: string; cached: boolean; events: number; durationSeconds: number }
  | { cast: string; outputs: OutputFile[]; frames: number; durationSeconds: number }
  | { cast: string; cached: boolean; outputs: OutputFile[]; frames: number; durationSeconds: number }
  | { cast: string; events: number; durationSeconds: number; outputs: OutputFile[] }
  | DiffResult
  | DoctorReport
  | TestSummary;

/** With --json, the only thing on stdout is one JSON document (results or { error }). */
const emit = (data: CliReport) => {
  if (json) process.stdout.write(JSON.stringify(data, null, 2) + "\n");
};
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
  if (json) process.stdout.write(JSON.stringify({ error: message }) + "\n");
  else console.error(`${red("error:")} ${message}`);
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
  if (values.font === "auto") o.font = "auto";
  else if (values.font) font.family = values.font;
  if (values["font-size"] !== undefined) font.size = num("font-size");
  if (values["line-height"] !== undefined) font.lineHeight = num("line-height");
  if (values["letter-spacing"] !== undefined) font.letterSpacing = num("letter-spacing");
  if (Object.keys(font).length && o.font !== "auto") o.font = font;
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
  if (values["max-pause"] !== undefined) o.maxPause = values["max-pause"];
  if (values.keys) o.keys = true;
  if (values.shadow) o.shadow = true;
  if (values.watermark || values["watermark-image"]) {
    o.watermark = { ...(values.watermark && { text: values.watermark }), ...(values["watermark-image"] && { image: values["watermark-image"] }) };
  }
  if (values.preset) {
    if (!presetNames.includes(values.preset as PresetName)) fail(`--preset must be one of ${presetNames.join(", ")}`);
    o.preset = values.preset as PresetName;
  }
  if (values.browser) {
    const position = values["browser-position"] as BrowserConfig["position"] | undefined;
    if (position && !["right", "left", "top", "bottom", "overlay"].includes(position)) fail("--browser-position must be right, left, top, bottom or overlay");
    o.browser = { url: values.browser, ...(position && { position }) };
  }
  return o;
}

/** `--from 2` and `--at 2` are seconds; `--from 1.5s` / `"2m"` go through the duration parser. */
function seconds(flag: "from" | "to" | "gap"): number | undefined {
  const raw = values[flag];
  if (raw === undefined) return undefined;
  return /^\s*\d+(\.\d+)?\s*$/.test(raw) ? Number(raw) : toMs(raw) / 1000;
}

function clipFromFlags(): ClipSelection | undefined {
  const clip: ClipSelection = {};
  const from = seconds("from");
  const to = seconds("to");
  if (from !== undefined) clip.from = from;
  if (to !== undefined) clip.to = to;
  if (values.chapters) clip.chapters = values.chapters.split(",").map((s) => s.trim()).filter(Boolean);
  if (values["split-chapters"]) clip.splitChapters = true;
  return Object.keys(clip).length ? clip : undefined;
}

function reportNotes(notes: string[] | undefined): void {
  for (const note of notes ?? []) log(dim(`  note: ${note}`));
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
      font: overrides.font === "auto" ? "auto" : { ...video.config.font, ...overrides.font },
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

async function reportOutputs(outputs: string[], screenshots: string[]): Promise<OutputFile[]> {
  for (const out of outputs) ok(`wrote ${out}`, await fileSize(out));
  for (const shot of screenshots) ok(`screenshot ${shot}`);
  return Promise.all([...outputs, ...screenshots].map(async (p) => ({ path: p, bytes: (await Bun.file(p).exists()) ? Bun.file(p).size : 0 })));
}

const TEMPLATES = new Map<string, (name: string) => string>([
  ["basic", (name) => `import { defineVideo } from "tcut";

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
`],
  ["tour", (name) => `import { defineVideo } from "tcut";

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
    await t.snapshot("${name}-notes.png");
    await t.sleep("1.5s");
  },
);
`],
  ["test", (name) => `import { defineVideo } from "tcut";

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
`],
]);

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
        const ask = async (label: string, flag: string | undefined, fallback: string): Promise<string> => {
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
          secretAccessKey: await ask("Secret key", values["secret-key"], existing?.secretAccessKey ?? ""),
          region: values.region ?? existing?.region ?? "us-east-1",
          publicUrl: values["public-url"] || existing?.publicUrl || undefined,
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
      emit({ published });
      if (values.open && published[0]) {
        const opener = process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
        Bun.spawn([opener, published[published.length - 1]!.url], { stdout: "ignore", stderr: "ignore" });
      }
      return;
    }
    case "init": {
      const name = rest[0] ?? "demo";
      const template = values.template ?? "basic";
      const make = TEMPLATES.get(template);
      if (!make) fail(`Unknown template "${template}". Available: ${[...TEMPLATES.keys()].join(", ")}`);
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
      // The shell tcut was typed into is the session (your prompt, config, aliases) and what `-- cmd` runs
      // through. --clean / --raw opt out: a plain shell with a `>` prompt, or the bare binary.
      const shell = values.clean || values.raw ? null : userShell();
      // In a terminal, a live recording looks like that terminal: its colours and font, unless told otherwise.
      const tty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
      const config = await applyTerminalLook(
        resolveConfig({
          theme: tty ? "auto" : undefined,
          font: tty ? "auto" : undefined,
          ...overrides,
          output: outputs,
          cast: overrides.cast,
          ...(rest.length === 0 && shell && { shell: "user" }),
        }),
        (m) => log(dim(`  ${m}`)),
      );
      let command: string[] | undefined;
      let portable: string[] | undefined;
      if (rest.length > 0) {
        if (shell) {
          const through = throughShell(rest, shell);
          command = through.argv;
          portable = through.portable;
          log(dim(`  via ${shell.name} — your aliases and functions apply (--raw runs the binary directly)`));
        } else {
          command = rest;
        }
      } else if (shell) {
        log(dim(`  your ${shell.name}, with its config (--clean for a plain shell with a > prompt)`));
      }
      // Size: --cols/--rows if given, else derived from --width/--height, else the terminal tcut runs in.
      const sized = overrides.width !== undefined || overrides.height !== undefined;
      const recording = await recordLive(config, {
        command,
        describe: rest.length > 0 ? rest.join(" ") : shell ? `your ${shell.name}` : undefined,
        log,
        cols: overrides.cols ?? (sized ? config.cols : undefined),
        rows: overrides.rows ?? (sized ? config.rows : undefined),
      });
      await mkdir(path.dirname(path.resolve(config.cast)), { recursive: true });
      await attachBrowserFrames(recording, path.resolve(config.cast));
      await writeCast(config.cast, recording);
      recording.source = path.resolve(config.cast);
      log("");
      ok(`wrote ${config.cast}`, `${recording.events.length} events, ${(recording.header.duration ?? 0).toFixed(1)}s`);
      if (!values["no-script"]) {
        const scriptPath = config.cast.replace(/\.cast$/, "") + ".video.ts";
        // A session in the user's own shell replays with run(): wait for whatever their prompt ends with.
        const promptPattern = !command && config.shell === "user" ? ((await detectPromptPattern(recording, config.core)) ?? undefined) : undefined;
        await Bun.write(scriptPath, generateScript(recording, { output: outputs, cleanShell: !command, command: portable ?? command, castPath: config.cast, promptPattern }));
        ok(`wrote ${scriptPath}`, "editable script — tweak it, then `tcut " + scriptPath + "`");
      }
      if (values["record-only"]) {
        emit({ cast: config.cast, script: values["no-script"] ? null : config.cast.replace(/\.cast$/, "") + ".video.ts", events: recording.events.length, durationSeconds: recording.header.duration ?? 0 });
        return;
      }
      const result = await renderOutputs(recording, config, progressReporter());
      const files = await reportOutputs(result.outputs, result.screenshots);
      log(dim(`  ${result.frames} frames, ${result.durationSeconds.toFixed(1)}s of video in ${elapsed()}`));
      emit({ cast: config.cast, script: values["no-script"] ? null : config.cast.replace(/\.cast$/, "") + ".video.ts", outputs: files, frames: result.frames, durationSeconds: result.durationSeconds });
      return;
    }
    case "record": {
      if (!rest[0]) fail("record needs a script file");
      const video = await loadVideo(rest[0]);
      const rec = await video.record({ log, force: values.force });
      ok(`${rec.cached ? "reused" : "wrote"} ${video.config.cast}`, `${rec.events.length} events, ${(rec.header.duration ?? 0).toFixed(1)}s, ${elapsed()}`);
      emit({ cast: video.config.cast, cached: rec.cached === true, events: rec.events.length, durationSeconds: rec.header.duration ?? 0 });
      return;
    }
    case "render": {
      if (!rest[0]) fail("render needs a .cast file");
      const result = await renderCast(rest[0], overridesFromFlags(), progressReporter(), clipFromFlags());
      const files = await reportOutputs(result.outputs, result.screenshots);
      reportNotes(result.notes);
      log(dim(`  ${result.frames} frames, ${result.durationSeconds.toFixed(1)}s of video in ${elapsed()}`));
      emit({ cast: rest[0], outputs: files, frames: result.frames, durationSeconds: result.durationSeconds });
      return;
    }
    case "doctor": {
      if (!rest[0]) fail("doctor needs a .cast file");
      const report = await diagnoseCast(rest[0]);
      if (!json) for (const line of formatDoctorReport(report)) console.log(line);
      emit(report);
      return;
    }
    case "cut":
    case "concat": {
      const joining = first === "concat";
      if (joining ? rest.length < 2 : !rest[0]) fail(joining ? "concat needs two or more .cast files" : "cut needs a .cast file");
      const clip = clipFromFlags();
      if (!joining && !clip) fail("cut needs --from/--to and/or --chapters");
      const castOut = values.cast ?? (joining ? path.join(path.dirname(rest[0]!), "concat.cast") : rest[0]!.replace(/\.cast$/, "") + "-cut.cast");
      const overrides = overridesFromFlags();
      delete overrides.cast;
      const parts: Array<{ rec: Recording; config: ResolvedConfig }> = [];
      for (const [i, file] of rest.entries()) {
        const rec = await readCast(file);
        const config = applyOverrides(castConfig(rec, file, values.output), overrides);
        parts.push({ rec: await rebaseBrowserFrames(rec, file, castOut, joining ? `${i}-` : ""), config });
      }
      let out: Recording;
      if (joining) {
        out = concatRecordings(parts, { gap: seconds("gap") ?? 0 });
      } else {
        const { rec, config } = parts[0]!;
        let part = rec;
        let partConfig = config;
        if (clip?.chapters) {
          part = selectChapters(rec, config, clip.chapters);
          partConfig = flattenedConfig(config);
        }
        out = clip && (clip.from !== undefined || clip.to !== undefined) ? cutRecording(part, partConfig, clip) : part;
      }
      const renderConfig = { ...flattenedConfig(parts[0]!.config), cast: castOut, output: values.output?.length ? values.output : parts[0]!.config.output };
      out.header.bunVideo = renderConfig;
      await mkdir(path.dirname(path.resolve(castOut)), { recursive: true });
      await writeCast(castOut, out);
      out.source = path.resolve(castOut);
      const durationSeconds = recordingDuration(out);
      ok(`wrote ${castOut}`, `${out.events.length} events, ${durationSeconds.toFixed(1)}s`);
      let files: OutputFile[] = [];
      if (values.output?.length) {
        const result = await renderOutputs(out, renderConfig, progressReporter());
        files = await reportOutputs(result.outputs, result.screenshots);
        reportNotes(result.notes);
        log(dim(`  ${result.frames} frames, ${result.durationSeconds.toFixed(1)}s of video in ${elapsed()}`));
      }
      emit({ cast: castOut, events: out.events.length, durationSeconds, outputs: files });
      return;
    }
    case "diff": {
      if (rest.length < 2) fail("diff needs two .cast files");
      const result = await diffCasts(rest[0]!, rest[1]!, { at: values.at !== undefined ? num("at") : undefined, images: values.images });
      emit(result);
      if (!json) {
        if (result.equal) ok("screens match");
        else {
          for (const line of result.lines) log(line.startsWith("- ") ? red(line) : line.startsWith("+ ") ? green(line) : dim(line));
          if (result.images) log(dim(`  images: ${result.images.a}  ${result.images.b}`));
        }
      }
      process.exit(result.equal ? 0 : 1);
    }
    // eslint-disable-next-line no-fallthrough -- process.exit above never returns
    case "test": {
      if (rest.length === 0) fail("test needs at least one script file or directory");
      const summary = await runScriptTests(rest, json ? () => {} : (line) => console.log(line));
      emit(summary);
      process.exit(summary.failed > 0 ? 1 : 0);
    }
    // eslint-disable-next-line no-fallthrough -- process.exit above never returns
    default: {
      const video = await loadVideo(first!);
      const result = await video.run({ log, force: values.force, recordOnly: values["record-only"], onProgress: progressReporter(), clip: clipFromFlags() });
      reportNotes(result.notes);
      ok(`${result.cached ? "reused" : "wrote"} ${result.cast}`);
      const files = await reportOutputs(result.outputs, result.screenshots);
      if (!values["record-only"]) log(dim(`  ${result.frames} frames, ${result.durationSeconds.toFixed(1)}s of video in ${elapsed()}`));
      emit({ cast: result.cast, cached: result.cached, outputs: files, frames: result.frames, durationSeconds: result.durationSeconds });
    }
  }
}

main().catch((cause: unknown) => {
  const message = cause instanceof Error ? cause.message : String(cause);
  if (json) process.stdout.write(JSON.stringify({ error: message, type: cause instanceof Error ? cause.name : "Error" }) + "\n");
  else console.error(`\n${red("error:")} ${message}`);
  process.exit(1);
});
