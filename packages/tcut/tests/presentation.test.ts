import { expect, test } from "bun:test";
import { mkdtemp, mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { record } from "../src/recorder";
import { buildTimeline } from "../src/timeline";
import { presentationSteps, takeSegments, validateTake, type PresentationManifest, type PresentationTake } from "../src/presentation/model";
import { preparePresentation, exportPresentationTake, runFfmpeg, writeJson } from "../src/presentation/media";
import { servePresentation } from "../src/presentation/server";
import { findEncoder } from "../src/renderer/encoder";
import type { CastEvent, Recording } from "../src/types";

const stepMarker = (at: number, id: string, title: string): CastEvent => [at, "m", `step:${JSON.stringify({ id, title, notes: "Speaker note" })}`];
const rec = (events: CastEvent[]): Recording => ({ header: { version: 2, width: 30, height: 8 }, events });

const manifest: PresentationManifest = { version: 1, id: "a".repeat(64), title: "Demo", fps: 10, width: 160, height: 90, duration: 2, steps: [{ id: "step-1", title: "One", notes: "", start: 0, end: 2, clip: "step-1.mp4", poster: "step-1.jpg" }] };

test("explicit steps preserve notes, exclude setup, and follow transformed timeline", () => {
  const events: CastEvent[] = [[0, "o", "setup"], stepMarker(1, "one", "First"), [2, "m", "hide"], [3, "m", "show"], [5, "m", "step:end:one"], stepMarker(6, "two", "Second"), [8, "m", "step:end:two"], [9, "m", "end"]];
  const timeline = buildTimeline(events, 2);
  const steps = presentationSteps(timeline.events, timeline.duration, 10);
  expect(steps.map(({ start, end, title, notes }) => ({ start, end, title, notes }))).toEqual([
    { start: 0.5, end: 2, title: "First", notes: "Speaker note" },
    { start: 2.5, end: 3.5, title: "Second", notes: "Speaker note" },
  ]);
});

test("chapters retain their introduction and an unmarked recording is one step", () => {
  const timeline = buildTimeline([[0, "o", "hi"], [1, "m", "chapter:Install"], [2, "m", "chapter:Run"], [3, "m", "end"]], 1);
  expect(presentationSteps(timeline.events, 3, 10).map((s) => [s.title, s.start, s.end])).toEqual([["Introduction", 0, 1], ["Install", 1, 2], ["Run", 2, 3]]);
  expect(presentationSteps([], 0, 10)[0]).toMatchObject({ start: 0, end: 0.1, title: "Demo" });
});

test("step recorder returns callback values, stores notes and rejects nesting", async () => {
  const result = await record(resolveConfig({ output: "x.mp4", endPause: 0, typingSpeed: 0 }), async (t) => {
    expect(await t.step("First", async () => {
      await expect(t.step("Nested", async () => {})).rejects.toThrow("nested");
      await t.run("echo step-output"); return 42;
    }, { notes: "Explain this" })).toBe(42);
    await t.step("Second", async () => {});
  });
  const steps = presentationSteps(buildTimeline(result.events, 1).events, 1, 30);
  expect(steps.map((s) => s.title)).toEqual(["First", "Second"]);
  expect(steps[0]?.notes).toBe("Explain this");
});

test("take boundaries quantize cumulatively and preserve holds and backward replay", () => {
  const take = { title: "Take", duration: 1.26, cues: [{ at: 0, source: 0.8, rate: 0 }, { at: 0.14, source: 0.1, rate: 1 }, { at: 0.33, source: 1.2, rate: 0 }] };
  validateTake(take, manifest);
  const segments = takeSegments(take, 10);
  expect(segments.map((s) => s.frames)).toEqual([1, 2, 10]);
  expect(segments.reduce((n, s) => n + s.frames, 0)).toBe(13);
  expect(() => validateTake({ ...take, cues: [{ at: 0, source: NaN, rate: 1 }] }, manifest)).toThrow("outside");
  expect(() => validateTake({ ...take, cues: [{ at: 1, source: 0, rate: 1 }] }, manifest)).toThrow("zero");
  expect(() => validateTake({ ...take, cues: [{ at: 0, source: 0, rate: -1 }] }, manifest)).toThrow("rate");
});

test("preparation caches recorded visuals and local server persists notes/takes with isolated file routes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "tcut-present-"));
  let server: Awaited<ReturnType<typeof servePresentation>> | undefined;
  try {
    const recording = rec([stepMarker(0, "one", "First"), [0, "o", "hello"], [0.3, "m", "step:end:one"], stepMarker(0.4, "two", "Second"), [0.4, "o", " next"], [0.8, "m", "step:end:two"], [1, "m", "end"]]);
    const config = resolveConfig({ output: "unused.mp4", fps: 10, width: 480, height: 300 });
    const prepared = await preparePresentation(recording, config, { directory });
    expect(prepared.cached).toBe(false);
    expect((await preparePresentation(recording, config, { directory })).cached).toBe(true);
    expect(prepared.manifest.steps).toHaveLength(2);
    server = await servePresentation(prepared);
    const origin = new URL(server.url).origin;
    const headers = { origin, "content-type": "application/json" };
    expect((await fetch(server.url)).status).toBe(200);
    expect((await fetch(server.url + "api/notes", { method: "POST", headers: { origin: "https://example.com", "content-type": "application/json" }, body: JSON.stringify({ id: "step-1", notes: "wrong" }) })).status).toBe(403);
    expect((await fetch(server.url + "api/notes", { method: "POST", headers, body: JSON.stringify({ id: "step-1", notes: "Updated note" }) })).status).toBe(200);
    expect((await Bun.file(path.join(directory, "presentation.json")).json()).steps[0].notes).toBe("Updated note");
    const media = await fetch(server.url + `media/${prepared.manifest.id}/step-1.mp4`, { headers: { range: "bytes=0-99" } });
    expect(media.status).toBe(206);
    expect((await media.arrayBuffer()).byteLength).toBe(100);
    const form = new FormData(); form.set("take", JSON.stringify({ title: "My take", duration: 1, cues: [{ at: 0, source: 0, rate: 0 }] }));
    form.set("audio", new Blob(["fixture"], { type: "audio/webm;codecs=opus" }), "microphone.webm");
    const response = await fetch(server.url + "api/takes", { method: "POST", headers: { origin }, body: form });
    expect(response.status).toBe(201);
    const saved = await response.json() as PresentationTake;
    expect(saved.title).toBe("My take");
    expect(saved.audio).toBe("microphone.webm");
    expect((await (await fetch(server.url + "api/takes")).json()).takes).toHaveLength(1);
    await server.close(); server = await servePresentation(prepared);
    expect((await (await fetch(server.url + "api/takes")).json()).takes[0].id).toBe(saved.id);
    expect((await fetch(server.url + "media/nope/etc/passwd")).status).toBe(404);
  } finally { await server?.close(); await rm(directory, { recursive: true, force: true }); }
}, 60_000);

async function probe(file: string): Promise<{ streams: Array<{ codec_type: string }>; format: { duration: string } }> {
  const p = Bun.spawn(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type:format=duration", "-of", "json", file], { stdout: "pipe", stderr: "pipe" });
  const result = await new Response(p.stdout).json(); expect(await p.exited).toBe(0); return result;
}

async function pixel(binary: string, file: string, at: number): Promise<Uint8Array> {
  const p = Bun.spawn([binary, "-v", "error", "-ss", String(at), "-i", file, "-frames:v", "1", "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "rgb24", "pipe:1"], { stdout: "pipe", stderr: "ignore" });
  const data = new Uint8Array(await new Response(p.stdout).arrayBuffer()); expect(await p.exited).toBe(0); return data;
}

test("exports keep paused frames, replay backwards, and align optional microphone audio", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "tcut-take-"));
  try {
    const binary = (await findEncoder("libx264"))!.binary;
    const sourceDir = path.join(directory, "sources", manifest.id);
    await mkdir(sourceDir, { recursive: true });
    await writeJson(path.join(sourceDir, "presentation.json"), manifest);
    await runFfmpeg(binary, ["-f", "lavfi", "-i", "color=red:s=160x90:r=10:d=1", "-f", "lavfi", "-i", "color=blue:s=160x90:r=10:d=1", "-filter_complex", "[0:v][1:v]concat=n=2:v=1:a=0", "-c:v", "libx264", "-pix_fmt", "yuv420p", path.join(sourceDir, "source.mp4")]);
    const take: PresentationTake = { version: 1, id: crypto.randomUUID(), presentationId: manifest.id, title: "Replay", createdAt: new Date().toISOString(), duration: 2, cues: [{ at: 0, source: 0.2, rate: 0 }, { at: 1, source: 1.2, rate: 0 }, { at: 1.5, source: 0.1, rate: 1 }], audio: "microphone.mp4" };
    const takeDir = path.join(directory, "takes", take.id); await mkdir(takeDir, { recursive: true });
    await runFfmpeg(binary, ["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-c:a", "aac", path.join(takeDir, take.audio!)]);
    const file = await exportPresentationTake(directory, take);
    const info = await probe(file);
    expect(Number(info.format.duration)).toBeCloseTo(2, 1);
    expect(info.streams.map((s) => s.codec_type)).toContain("audio");
    for (const t of [0.2, 0.8, 1.8]) { const p = await pixel(binary, file, t); expect(p[0]!).toBeGreaterThan(200); expect(p[2]!).toBeLessThan(30); }
    const blue = await pixel(binary, file, 1.2); expect(blue[2]!).toBeGreaterThan(200); expect(blue[0]!).toBeLessThan(30);
    expect(Bun.file(await exportPresentationTake(directory, take, { format: "gif" })).size).toBeGreaterThan(100);
    const webm = await probe(await exportPresentationTake(directory, take, { format: "webm" }));
    expect(webm.streams.map((s) => s.codec_type)).toContain("audio");
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 60_000);

test("CLI preparation reuses its recorded source and never reruns commands for another walkthrough", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "tcut-present-cli-"));
  try {
    const counter = path.join(directory, "runs.txt");
    const script = path.join(directory, "demo.video.ts");
    await Bun.write(script, `import { defineVideo } from "termcut";
export default defineVideo({ output: ${JSON.stringify(path.join(directory, "demo.mp4"))}, fps: 5, cols: 20, rows: 5, typingSpeed: 0, endPause: 0 }, async t => {
 await t.step("Run once", async () => { await Bun.write(${JSON.stringify(counter)}, (await Bun.file(${JSON.stringify(counter)}).exists() ? await Bun.file(${JSON.stringify(counter)}).text() : "") + "run\\n"); await t.run("echo recorded"); await t.sleep("200ms"); });
});`);
    for (const cached of [false, true]) {
      const p = Bun.spawn(["bun", path.resolve(import.meta.dir, "../src/cli.ts"), "present", script, "--directory", path.join(directory, "workspace"), "--prepare-only", "--json"], { stdout: "pipe", stderr: "pipe" });
      const [output, error, exit] = await Promise.all([new Response(p.stdout).text(), new Response(p.stderr).text(), p.exited]);
      expect(error).toBe(""); expect(exit).toBe(0); expect(JSON.parse(output).cached).toBe(cached);
    }
    expect(await Bun.file(counter).text()).toBe("run\n");
  } finally { await rm(directory, { recursive: true, force: true }); }
}, 60_000);
