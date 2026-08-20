import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { runScriptTests } from "../src/testing";
import { Video, defineVideo } from "../src/video";

const fixtures = path.join(import.meta.dir, "fixtures");
const cli = path.join(import.meta.dir, "..", "src", "cli.ts");

async function run(args: string[], cwd?: string): Promise<{ code: number; out: string; err: string }> {
  const proc = Bun.spawn(["bun", cli, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [out, err] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
  return { code: await proc.exited, out, err };
}

describe("tcut test", () => {
  test("runs fixtures in fast mode and reports TAP", async () => {
    const lines: string[] = [];
    const started = performance.now();
    const summary = await runScriptTests([fixtures], (l) => lines.push(l));
    expect(performance.now() - started).toBeLessThan(20_000); // the 30 s sleep in pass.tcut.ts is skipped
    expect(summary.passed).toBe(1);
    expect(summary.failed).toBe(1);
    const text = lines.join("\n");
    expect(text).toContain("ok 2 - tests/fixtures/pass.tcut.ts");
    expect(text).toContain("not ok 1 - tests/fixtures/fail.tcut.ts");
    expect(text).toContain("definitely-absent");
  }, 30_000);

  test("CLI exit codes", async () => {
    expect((await run(["test", path.join(fixtures, "pass.tcut.ts")])).code).toBe(0);
    expect((await run(["test", path.join(fixtures, "fail.tcut.ts")])).code).toBe(1);
  }, 30_000);
});

describe("cast cache", () => {
  const dir = "/tmp/tcut-cache-test";

  test("hit when unchanged, miss after edit, bypass with force", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const script = path.join(dir, "cached.video.ts");
    const write = (body: string) =>
      Bun.write(
        script,
        `import { defineVideo } from "${path.join(import.meta.dir, "..", "src", "index.ts")}";\nexport default defineVideo({ output: "${dir}/out.mp4", shell: "bash", endPause: 0, typingSpeed: 0 }, async (t) => { await t.run("echo ${body}"); });\n`,
      );
    await write("one");
    const load = async () => {
      const mod = (await import(`${script}?t=${Date.now()}-${Math.random()}`)) as { default: Video };
      mod.default.source = script;
      return mod.default;
    };

    const v1 = await load();
    const first = await v1.record();
    expect(first.cached).toBeUndefined();
    expect(first.header.scriptHash).toMatch(/^[0-9a-f]{64}$/);

    const second = await v1.record();
    expect(second.cached).toBe(true);

    const forced = await v1.record({ force: true });
    expect(forced.cached).toBeUndefined();

    await write("two");
    const v2 = await load();
    const third = await v2.record();
    expect(third.cached).toBeUndefined();
    expect(third.events.some((e) => e[1] === "o" && e[2].includes("two"))).toBe(true);
  }, 30_000);

  test("no source path → never cached", async () => {
    const v = defineVideo({ output: "/tmp/tcut-cache-test/nosrc.mp4", shell: "bash", endPause: 0, typingSpeed: 0 }, async (t) => {
      await t.run("true");
    });
    expect(await v.cachedRecording()).toBeUndefined();
  });
});

describe("init", () => {
  test("scaffolds templates", async () => {
    const dir = "/tmp/tcut-init-test";
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    expect((await run(["init", "demo"], dir)).code).toBe(0);
    expect(await Bun.file(path.join(dir, "demo.video.ts")).exists()).toBe(true);
    expect((await run(["init", "checks", "--template", "test"], dir)).code).toBe(0);
    expect(await Bun.file(path.join(dir, "checks.tcut.ts")).text()).toContain("tcut test");
    expect((await run(["init", "demo"], dir)).code).toBe(1); // refuses to overwrite
    expect((await run(["init", "x", "--template", "nope"], dir)).code).toBe(1);
  });
});

describe("--json", () => {
  test("success and error are single JSON documents on stdout", async () => {
    const cast = path.join(import.meta.dir, "..", "docs", "demo.cast");
    const okRun = await run(["render", cast, "-o", "/tmp/tcut-json-test/out.svg", "--json"]);
    expect(okRun.code).toBe(0);
    const parsed = JSON.parse(okRun.out) as { outputs: Array<{ path: string; bytes: number }>; frames: number };
    expect(parsed.outputs[0]?.bytes).toBeGreaterThan(0);
    expect(parsed.frames).toBeGreaterThan(0);
    const bad = await run(["render", "/tmp/does-not-exist.cast", "--json"]);
    expect(bad.code).toBe(1);
    expect(JSON.parse(bad.out)).toMatchObject({ error: expect.stringContaining("not found") });
  }, 60_000);
});
