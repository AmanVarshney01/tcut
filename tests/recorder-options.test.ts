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
