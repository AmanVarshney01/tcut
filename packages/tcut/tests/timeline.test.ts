import { describe, expect, test } from "bun:test";
import { formatMs, toMs } from "../src/duration";
import { altSequence, ctrlSequence, keySequence } from "../src/keys";
import { buildTimeline } from "../src/timeline";
import { parseCast, serializeCast } from "../src/cast";
import type { CastEvent, Recording } from "../src/types";

describe("duration", () => {
  test("parses numbers and unit strings", () => {
    expect(toMs(250)).toBe(250);
    expect(toMs("500ms")).toBe(500);
    expect(toMs("1.5s")).toBe(1500);
    expect(toMs("2m")).toBe(120_000);
    expect(toMs(undefined, 7)).toBe(7);
  });
  test("rejects garbage", () => {
    expect(() => toMs("fast")).toThrow();
    expect(() => toMs(-1)).toThrow();
  });
  test("formats", () => {
    expect(formatMs(500)).toBe("500ms");
    expect(formatMs(1500)).toBe("1.5s");
    expect(formatMs(2000)).toBe("2s");
  });
});

describe("keys", () => {
  test("control characters", () => {
    expect(ctrlSequence("c")).toBe("\x03");
    expect(ctrlSequence("C")).toBe("\x03");
    expect(ctrlSequence("[")).toBe("\x1b");
  });
  test("named keys and alt", () => {
    expect(keySequence("up")).toBe("\x1b[A");
    expect(altSequence("b")).toBe("\x1bb");
    expect(altSequence("left")).toBe("\x1b\x1b[D");
  });
});

describe("timeline", () => {
  const events: CastEvent[] = [
    [0.0, "o", "prompt"],
    [1.0, "m", "hide"],
    [1.5, "o", "secret"],
    [3.0, "m", "show"],
    [4.0, "o", "visible"],
    [4.2, "i", "typed"],
    [5.0, "m", "end"],
  ];

  test("collapses hidden intervals and drops input", () => {
    const { events: out, duration } = buildTimeline(events, 1);
    expect(out.map((e) => [e.vt, e.type, e.data])).toEqual([
      [0.0, "o", "prompt"],
      [1.0, "o", "secret"], // lands on the instant the hide began
      [2.0, "o", "visible"], // 4.0 - 2.0 hidden
      [3.0, "m", "end"],
    ]);
    expect(duration).toBe(3.0);
  });

  test("applies playback speed", () => {
    const { events: out, duration } = buildTimeline(events, 2);
    expect(out.at(-1)?.vt).toBe(1.5);
    expect(duration).toBe(1.5);
  });
});

describe("cast", () => {
  test("round-trips asciicast v2", () => {
    const rec: Recording = {
      header: { version: 2, width: 80, height: 24, env: { TERM: "xterm-256color" } },
      events: [
        [0.1, "o", "hi\r\n"],
        [0.2, "m", "hide"],
      ],
    };
    const text = serializeCast(rec);
    expect(text.split("\n")[0]).toContain('"version":2');
    expect(parseCast(text)).toEqual(rec);
  });
  test("rejects other versions", () => {
    expect(() => parseCast('{"version":1,"width":1,"height":1}\n')).toThrow(/version/);
  });
});
