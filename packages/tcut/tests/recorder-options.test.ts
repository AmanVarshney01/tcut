import { describe, expect, test } from "bun:test";
import { resolveConfig } from "../src/config";
import { record } from "../src/recorder";
import type { VideoConfig } from "../src/types";

const base: VideoConfig = { output: "/tmp/tcut-test/out.mp4", cast: "/tmp/tcut-test/out.cast", shell: "bash", endPause: 0, typingSpeed: 0 };

describe("recorder options", () => {
  test("quantize snaps timestamps to the frame grid", async () => {
    const fps = 30;
    const rec = await record(resolveConfig({ ...base, quantize: true, fps }), async (t) => {
      await t.run("echo a");
      await t.sleep(75);
      await t.run("echo b");
    });
    for (const [time] of rec.events) {
      const scaled = time * fps;
      expect(Math.abs(scaled - Math.round(scaled))).toBeLessThan(1e-6);
    }
  });

  test("lite core still drives run/expect", async () => {
    const rec = await record(resolveConfig({ ...base, core: "lite" }), async (t) => {
      await t.run("echo lite-$((2+2))");
      await t.expect(/lite-4/);
    });
    expect(rec.header.bunVideo?.core).toBe("lite");
  });

  test("fast mode skips sleeps and typing delay", async () => {
    const started = performance.now();
    await record(resolveConfig({ ...base, typingSpeed: "200ms", endPause: "5s" }), async (t) => {
      await t.sleep("10s");
      await t.run("echo quick");
      await t.expect(/quick/);
    }, { fast: true });
    expect(performance.now() - started).toBeLessThan(5000);
  });
});

describe("prompt detection after screen residue", () => {
  test("prompt printed over stale text (as after a TUI exits) is still detected", async () => {
    const rec = await record(resolveConfig({ ...base, waitTimeout: 5000 }), async (t) => {
      // Leave text on the line and put the cursor back at column 0; the next prompt overwrites only "> ".
      await t.run("printf 'STALE TEXT AFTER CURSOR\\r'");
      expect(t.line()).toContain("ALE TEXT AFTER CURSOR"); // "> " overwrote the first two stale chars
      await t.run("echo after-residue");
      await t.expect(/after-residue/);
    });
    expect(rec.events.length).toBeGreaterThan(0);
  });
});

describe("print() and title()", () => {
  test("captions land in the cast and on screen, never in the shell, and the prompt comes back", async () => {
    const rec = await record(resolveConfig({ ...base, cols: 60, rows: 16 }), async (t) => {
      await t.title("Shipping", { pause: 0 });
      await t.print("## Step 1\nSome **bold** and `code`.");
      expect(t.screen()).toContain("Shipping");
      expect(t.screen()).toContain("Step 1");
      expect(t.line()).toMatch(/^>\s*$/);
      await t.run("echo after-caption");
      await t.expect(/after-caption/);
    });
    const inputs = rec.events.filter((e) => e[1] === "i").map((e) => e[2]).join("");
    expect(inputs).not.toContain("Step 1"); // nothing typed into the shell
    const outputs = rec.events.filter((e) => e[1] === "o").map((e) => e[2]).join("");
    expect(outputs).toContain("\x1b[1m\x1b[97mShipping\x1b[0m");
    expect(outputs).toContain("\x1b[1mbold\x1b[0m");
  });
});
