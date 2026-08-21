import { describe, expect, test } from "bun:test";
import { PassThrough } from "node:stream";
import { resolveConfig } from "../src/config";
import { recordLive } from "../src/live";
import { record } from "../src/recorder";
import { eventsToOps, generateScript, tokenize } from "../src/scriptgen";
import type { Recording, Script } from "../src/types";

const rec = (inputs: Array<[number, string]>): Recording => ({
  header: { version: 2, width: 80, height: 24, bunVideo: resolveConfig({ output: "x.mp4" }) },
  events: inputs.map(([t, d]) => [t, "i", d] as const).map((e) => [e[0], e[1], e[2]]),
});

describe("tokenize", () => {
  test("splits escape sequences, control chars and printable runs", () => {
    expect(tokenize("ls -la\r")).toEqual(["ls -la", "\r"]);
    expect(tokenize("\x1b[A\x1b[B")).toEqual(["\x1b[A", "\x1b[B"]);
    expect(tokenize("a\x03b")).toEqual(["a", "\x03", "b"]);
    expect(tokenize("\x1bb")).toEqual(["\x1bb"]); // alt+b
    expect(tokenize("\x7f\x7f")).toEqual(["\x7f", "\x7f"]);
  });
});

describe("eventsToOps", () => {
  test("clean shell: typed line + Enter becomes run(); pauses become sleep(); keys are merged", () => {
    const ops = eventsToOps(
      rec([
        [0.0, "e"], [0.05, "c"], [0.1, "h"], [0.15, "o"], [0.2, " hi"], [0.25, "\r"],
        [2.0, "\x1b[A"], [2.1, "\x1b[A"], [2.2, "\x7f"], [2.3, "\x03"],
        [2.4, "exit\r"],
      ]),
      { output: ["x.mp4"], cleanShell: true },
    );
    expect(ops).toEqual([
      { kind: "run", command: "echo hi" },
      { kind: "sleep", ms: 1750 },
      { kind: "key", name: "up", times: 2 },
      { kind: "key", name: "backspace", times: 1 },
      { kind: "ctrl", letter: "c", times: 1 },
    ]);
  });

  test("command mode: Enter stays a key press and text stays type()", () => {
    const ops = eventsToOps(rec([[0, "y"], [0.1, "\r"]]), { output: ["x.gif"], cleanShell: false, command: ["bun", "create", "x"] });
    expect(ops).toEqual([
      { kind: "type", text: "y" },
      { kind: "key", name: "enter", times: 1 },
    ]);
  });
});

describe("generateScript", () => {
  test("emits a runnable defineVideo file", () => {
    const src = generateScript(rec([[0, "echo hi\r"]]), { output: ["demo.gif"], cleanShell: true, castPath: "demo.cast" });
    expect(src).toContain('import { defineVideo } from "tcut"');
    expect(src).toContain('output: ["demo.gif"]');
    expect(src).toContain('await t.run("echo hi");');
    expect(src).toContain("demo.cast");
    expect(src).not.toContain("run(\"exit\")");
  });

  test("command mode sets shell to the command", () => {
    const src = generateScript(rec([[0, "\r"]]), { output: ["x.mp4"], cleanShell: false, command: ["bash", "-c", "echo x"] });
    expect(src).toContain('shell: ["bash","-c","echo x"]');
    expect(src).toContain("await t.enter();");
  });

  test("round trip: live session → script → re-recorded with the scripted recorder", async () => {
    const stdin = new PassThrough();
    const live = recordLive(resolveConfig({ output: "/tmp/tcut-sg/x.mp4" }), {
      cols: 60,
      rows: 12,
      stdin,
      stdout: { write: () => undefined },
    });
    await Bun.sleep(700);
    stdin.write("echo round-trip-$((20+3))\r");
    await Bun.sleep(500);
    stdin.write("exit\r");
    const recording = await live;
    const src = generateScript(recording, { output: ["/tmp/tcut-sg/x.mp4"], cleanShell: true });
    expect(src).toContain('await t.run("echo round-trip-$((20+3))");');

    // Execute the generated body against the scripted recorder.
    const body = /async \(t\) => \{([\s\S]*)\n  \},\n\);/.exec(src)![1]!;
    const script = new Function("t", `return (async () => {${body.replace(/await t\.sleep\("1s"\);\s*$/, "")}})();`) as Script;
    const replay = await record(resolveConfig({ output: "/tmp/tcut-sg/x.mp4", endPause: 0, typingSpeed: 0 }), script);
    const out = replay.events.filter((e) => e[1] === "o").map((e) => e[2]).join("");
    expect(out).toContain("round-trip-23");
  }, 30_000);
});
