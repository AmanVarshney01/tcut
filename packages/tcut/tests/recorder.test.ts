import { describe, expect, test } from "bun:test";
import { ExpectationError, WaitTimeoutError, defineVideo } from "tcut";
import { resolveConfig } from "../src/config";
import { record } from "../src/recorder";
import type { CastEvent, VideoConfig } from "../src/types";

const base: VideoConfig = { output: "/tmp/tcut-test/out.mp4", cast: "/tmp/tcut-test/out.cast", shell: "bash", endPause: 0, typingSpeed: 0 };

const markers = (events: CastEvent[]) => events.filter((e) => e[1] === "m").map((e) => e[2]);

describe("recorder", () => {
  test("run() waits for the prompt and expect() sees the output", async () => {
    const rec = await record(resolveConfig(base), async (t) => {
      await t.run("echo tcut-$((1+1))");
      await t.expect(/tcut-2/);
      expect(t.line()).toMatch(/>\s*$/);
    });
    expect(rec.header.width).toBe(80);
    expect(rec.header.height).toBe(24);
    const output = rec.events.filter((e) => e[1] === "o").map((e) => e[2]).join("");
    expect(output).toContain("tcut-2");
    expect(markers(rec.events)).toEqual(["end"]);
  });

  test("hide() records hide/show markers and keeps state", async () => {
    const rec = await record(resolveConfig(base), async (t) => {
      await t.hide(async () => {
        await t.run("export VT_SECRET=shh");
        await t.hide(() => t.run("true")); // nested hide collapses
      });
      await t.run("echo $VT_SECRET");
      await t.expect(/^shh$/m);
    });
    expect(markers(rec.events)).toEqual(["hide", "show", "end"]);
  });

  test("expect() failure throws with a screen dump", async () => {
    const promise = record(resolveConfig(base), async (t) => {
      await t.run("echo present");
      await t.expect(/absent-text/);
    });
    await expect(promise).rejects.toBeInstanceOf(ExpectationError);
    await expect(promise).rejects.toThrow(/present/);
  });

  test("run() times out with the screen in the message", async () => {
    const promise = record(resolveConfig({ ...base, waitTimeout: 500 }), async (t) => {
      await t.run("sleep 30");
    });
    await expect(promise).rejects.toBeInstanceOf(WaitTimeoutError);
    await expect(promise).rejects.toThrow(/sleep 30/);
  });

  test("resize() records an r event and the shell sees the new size", async () => {
    const rec = await record(resolveConfig(base), async (t) => {
      await t.resize(100, 30);
      await t.run("tput cols");
      // ConPTY does not deliver SIGWINCH to the child, so on Windows the shell keeps reporting the old size.
      if (process.platform !== "win32") await t.expect(/^100$/m);
    });
    expect(rec.events.some((e) => e[1] === "r" && e[2] === "100x30")).toBe(true);
  });

  test("snapshot(), its screenshot() alias, and marker() are recorded", async () => {
    const rec = await record(resolveConfig(base), async (t) => {
      await t.snapshot("/tmp/tcut-test/still.svg");
      await t.screenshot("/tmp/tcut-test/shot.png");
      await t.marker("chapter-1");
    });
    expect(markers(rec.events)).toEqual(["screenshot:/tmp/tcut-test/still.svg", "screenshot:/tmp/tcut-test/shot.png", "chapter-1", "end"]);
  });

  test('shell: "user" records in the user\'s own shell and run() waits for its prompt', async () => {
    if (process.platform === "win32") return;
    const saved = process.env.SHELL;
    process.env.SHELL = "/bin/bash"; // under bun test the parent is bun, so $SHELL decides
    try {
      const rec = await record(resolveConfig({ ...base, shell: "user", promptPattern: /\$\s*$/ }), async (t) => {
        await t.run("echo user-shell-$((40+2))");
        await t.expect(/user-shell-42/);
      });
      expect(rec.header.bunVideo?.shell).toBe("user");
    } finally {
      if (saved === undefined) delete process.env.SHELL;
      else process.env.SHELL = saved;
    }
  });

  test("programs that query the terminal get an answer", async () => {
    // Ask for Device Attributes and read the reply the shell receives on stdin.
    const rec = await record(resolveConfig({ ...base, waitTimeout: 5000 }), async (t) => {
      await t.run(`printf '\\033[c'; IFS= read -rs -t 2 -d c reply; printf 'reply=%q\\n' "$reply"`);
      // On Windows ConPTY answers DA itself (a different id); elsewhere the answer comes from tcut's screen model.
      await t.expect(process.platform === "win32" ? /reply=\$'\\E\[\?/ : /reply=\$'\\E\[\?1;2'/);
    });
    expect(rec.events.length).toBeGreaterThan(0);
  });

  test("defineVideo exposes resolved config", () => {
    const video = defineVideo({ output: "x.mp4", prompt: "$ " }, async () => {});
    expect(video.config.cast).toBe("x.cast");
    expect(new RegExp(video.config.promptPattern).test("user@host $ ")).toBe(true);
  });
});
