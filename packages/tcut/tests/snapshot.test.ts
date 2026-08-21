import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { renderOutputs } from "../src/render";
import type { Recording } from "../src/types";

const dir = "/tmp/tcut-snapshot-test";

// Two snapshot marks around a second line of output: each must capture its own moment.
const cast: Recording = {
  header: { version: 2, width: 24, height: 6 },
  events: [
    [0.0, "o", "first\r\n"],
    [0.2, "m", "screenshot:" + path.join(dir, "early.svg")],
    [0.5, "o", "second\r\n"],
    [0.8, "m", "screenshot:" + path.join(dir, "late.svg")],
    [0.9, "m", "end"],
  ],
};

describe("svg snapshots", () => {
  test("capture their exact moment, are static, and are written alongside vector outputs", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const out = path.join(dir, "out.svg");
    const config = resolveConfig({ output: [out], fps: 10, cols: 24, rows: 6 });

    const result = await renderOutputs(cast, config);
    expect(result.outputs).toEqual([out]);
    expect(result.screenshots).toEqual([path.join(dir, "early.svg"), path.join(dir, "late.svg")]);

    const early = await Bun.file(path.join(dir, "early.svg")).text();
    const late = await Bun.file(path.join(dir, "late.svg")).text();
    expect(early).toContain("first");
    expect(early).not.toContain("second");
    expect(late).toContain("second");
    // stills carry no animation; the animated export still does
    expect(early).not.toContain("@keyframes");
    expect(await Bun.file(out).text()).toContain("@keyframes");
  });

  test("hidden sections shift the captured moment like every other export", async () => {
    const shotDir = path.join(dir, "hide");
    await rm(shotDir, { recursive: true, force: true });
    await mkdir(shotDir, { recursive: true });
    const hidden: Recording = {
      header: { version: 2, width: 24, height: 6 },
      events: [
        [0.0, "o", "kept\r\n"],
        [0.1, "m", "hide"],
        [0.2, "o", "secret\r\n"],
        [0.9, "m", "show"],
        [1.0, "m", "screenshot:" + path.join(shotDir, "still.svg")],
        [1.1, "m", "end"],
      ],
    };
    const config = resolveConfig({ output: [path.join(shotDir, "out.svg")], fps: 10, cols: 24, rows: 6 });
    const result = await renderOutputs(hidden, config);
    expect(result.screenshots).toEqual([path.join(shotDir, "still.svg")]);
    const svg = await Bun.file(path.join(shotDir, "still.svg")).text();
    expect(svg).toContain("kept");
    expect(svg).toContain("secret"); // state changes from hidden sections land on the frame after `show`
  });

  test("a mark between frame ticks includes output recorded just before it", async () => {
    const d = path.join(dir, "boundary");
    await rm(d, { recursive: true, force: true });
    await mkdir(d, { recursive: true });
    // At 10 fps the ticks are 0.3 and 0.4: output lands at 0.31, the mark at 0.33 — both belong to tick 0.4.
    const rec: Recording = {
      header: { version: 2, width: 24, height: 6 },
      events: [
        [0.0, "o", "first\r\n"],
        [0.31, "o", "second\r\n"],
        [0.33, "m", "screenshot:" + path.join(d, "still.svg")],
        [0.5, "m", "end"],
      ],
    };
    const config = resolveConfig({ output: [path.join(d, "out.svg")], fps: 10, cols: 24, rows: 6 });
    await renderOutputs(rec, config);
    expect(await Bun.file(path.join(d, "still.svg")).text()).toContain("second");
  });
});
