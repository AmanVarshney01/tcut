import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { parseCast } from "../src/cast";
import { resolveConfig } from "../src/config";
import { recordLive } from "../src/live";

const dir = "/tmp/tcut-live-test";
const cli = path.join(import.meta.dir, "..", "src", "cli.ts");

describe("live recording", () => {
  test("captures a command's real output without a script", async () => {
    const chunks: string[] = [];
    const rec = await recordLive(resolveConfig({ output: `${dir}/x.mp4` }), {
      command: ["bash", "-c", "printf 'live-\\033[32mok\\033[0m\\n'; sleep 0.2; echo done"],
      cols: 40,
      rows: 10,
      stdin: null,
      stdout: { write: (d) => chunks.push(d instanceof Uint8Array ? new TextDecoder().decode(d) : d) },
    });
    const out = rec.events.filter((e) => e[1] === "o").map((e) => e[2]).join("");
    expect(out).toContain("live-\x1b[32mok\x1b[0m");
    expect(out).toContain("done");
    expect(chunks.join("")).toContain("done"); // mirrored to the terminal
    expect(rec.header.width).toBe(40);
    expect(rec.header.height).toBe(10);
    expect(rec.events.at(-1)?.[1]).toBe("m");
    expect(rec.events.at(-1)?.[2]).toBe("end");
    expect(rec.header.duration ?? 0).toBeGreaterThan(0.15);
  });

  test("tcut rec -- <command> writes a cast and renders", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const proc = Bun.spawn(["bun", cli, "rec", "--cast", `${dir}/rec.cast`, "-o", `${dir}/rec.svg`, "-q", "--", "bash", "-c", "echo from-rec"], {
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    const [code, out, err] = await Promise.all([proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text()]);
    expect(err).toBe("");
    expect(code).toBe(0);
    expect(out).toContain("from-rec"); // live mirror
    const cast = parseCast(await Bun.file(`${dir}/rec.cast`).text());
    expect(cast.events.some((e) => e[1] === "o" && e[2].includes("from-rec"))).toBe(true);
    expect(Bun.file(`${dir}/rec.svg`).size).toBeGreaterThan(0);
  }, 30_000);
});
