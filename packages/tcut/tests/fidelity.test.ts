import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { resolveConfig } from "../src/config";
import { diagnoseRecording } from "../src/doctor";
import { buildSvg } from "../src/export/svg";
import { replayFrames } from "../src/export/frames";
import { keySequence } from "../src/keys";
import { extractTitle, hyperlink, linkifyMarkdown, unsupportedProtocols } from "../src/osc";
import { record } from "../src/recorder";
import { renderOutputs } from "../src/render";
import { Screen } from "../src/screen";
import type { Recording } from "../src/types";

const ESC = "\x1b";
const dir = "/tmp/tcut-fidelity-test";
const rec = (events: Recording["events"], cols = 40, rows = 6): Recording => ({ header: { version: 2, width: cols, height: rows }, events });

describe("osc helpers", () => {
  test("title, hyperlink, markdown links, unsupported protocols", () => {
    expect(extractTitle(`x${ESC}]0;first\x07y${ESC}]2;second${ESC}\\z`)).toBe("second");
    expect(extractTitle("no title here")).toBeNull();
    expect(hyperlink("docs", "https://a.b")).toBe(`${ESC}]8;;https://a.b${ESC}\\docs${ESC}]8;;${ESC}\\`);
    expect(linkifyMarkdown("see [the docs](https://tcut.amanv.dev) now")).toContain(`${ESC}]8;;https://tcut.amanv.dev${ESC}\\`);
    expect(unsupportedProtocols(`${ESC}_Gf=100;AAAA${ESC}\\ ${ESC}Pq#0;2;0;0;0${ESC}\\`).map((u) => u.name)).toEqual(["kitty-graphics", "sixel"]);
  });
});

describe("application cursor keys and bracketed paste", () => {
  test("SS3 arrows only in app mode", () => {
    expect(keySequence("up")).toBe(`${ESC}[A`);
    expect(keySequence("up", { appCursor: true })).toBe(`${ESC}OA`);
    expect(keySequence("f5", { appCursor: true })).toBe(`${ESC}[15~`);
  });
  // One independent session per mode: a single `read` each, so no cross-read byte miscount can desync them.
  const readKey = async (setup: string, press: (t: import("../src/types").TerminalSession) => Promise<void>, bytes: number): Promise<string[]> => {
    const out = await record(resolveConfig({ output: `${dir}/x.mp4`, cols: 70, rows: 8, endPause: 0, typingSpeed: 0 }), async (t) => {
      await t.type(`printf '${setup}'; IFS= read -rs -n${bytes} k; printf 'K=%q\\n' "$k"\n`);
      await t.sleep(300);
      await press(t);
      await t.wait(/K=/, { scope: "screen" });
    });
    return out.events.filter((e) => e[1] === "i").map((e) => e[2]);
  };

  test("cursor keys use SS3 only in application cursor mode", async () => {
    expect(await readKey("\\033[?1h", (t) => t.up(), 3)).toContain(`${ESC}OA`);
    expect(await readKey("", (t) => t.down(), 3)).toContain(`${ESC}[B`);
  }, 20_000);

  test("paste is bracketed when the program enabled it", async () => {
    expect(await readKey("\\033[?2004h", (t) => t.paste("pasted"), 18)).toContain(`${ESC}[200~pasted${ESC}[201~`);
    expect(await readKey("", (t) => t.paste("plain"), 5)).toContain("plain");
  }, 20_000);
});

describe("scrollback", () => {
  test("Screen exposes scrollback and transcript, and expect() can see scrolled-off text", async () => {
    const screen = await Screen.create(20, 3);
    for (let i = 1; i <= 6; i++) screen.write(`line ${i}\r\n`);
    expect(screen.scrollback()[0]).toBe("line 1");
    expect(screen.transcript().split("\n").slice(0, 6)).toEqual(["line 1", "line 2", "line 3", "line 4", "line 5", "line 6"]);
    const out = await record(resolveConfig({ output: `${dir}/x.mp4`, cols: 40, rows: 5, endPause: 0, typingSpeed: 0 }), async (t) => {
      await t.run("seq 1 30");
      await expect(t.expect(/^7$/m)).rejects.toThrow();
      await t.expect(/^7$/m, { scope: "scrollback" });
      expect(t.scrollback()).toContain("\n7\n");
    });
    expect(out.events.length).toBeGreaterThan(0);
  }, 20_000);
  test(".log output is the transcript", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    const file = path.join(dir, "t.log");
    const cast = rec([[0, "o", Array.from({ length: 9 }, (_, i) => `row ${i + 1}\r\n`).join("")], [0.5, "m", "end"]]);
    await renderOutputs(cast, resolveConfig({ output: file, cols: 40, rows: 4 }));
    const text = await Bun.file(file).text();
    expect(text.startsWith("row 1\nrow 2\n")).toBe(true);
    expect(text).toContain("row 9");
  });
});

describe("replay fidelity", () => {
  test("synchronized output holds the previous frame until the block closes", async () => {
    const cast = rec([
      [0, "o", "ready\r\n"],
      [0.2, "o", `${ESC}[?2026h${ESC}[2J${ESC}[Hhalf`],
      [0.4, "o", ` done${ESC}[?2026l`],
      [0.6, "m", "end"],
    ]);
    const replay = await replayFrames(cast, resolveConfig({ output: "x.svg", cols: 40, rows: 6, fps: 10 }));
    const texts = replay.frames.map((f) => [...f.rows_.values()].map((cells) => cells.map((c) => c.text).join("").trim()).join("|"));
    expect(texts.some((t) => t === "half")).toBe(false); // the torn state never becomes a frame
    expect(texts.some((t) => t.includes("half done"))).toBe(true);
  });
  test("links reach the SVG and the auto title follows OSC", async () => {
    const cast = rec([[0, "o", `${ESC}]0;vim notes.md\x07${hyperlink("docs", "https://tcut.amanv.dev")} rest\r\n`], [0.3, "m", "end"]]);
    const replay = await replayFrames(cast, resolveConfig({ output: "x.svg", cols: 40, rows: 6 }));
    expect(replay.title).toBe("vim notes.md");
    const { svg } = await buildSvg(cast, resolveConfig({ output: "x.svg", cols: 40, rows: 6, windowBar: "colorful", title: "auto" }));
    expect(svg).toContain('<a href="https://tcut.amanv.dev">');
    expect(svg).toContain(">vim notes.md</text>");
  });
});

describe("doctor", () => {
  test("reports features, unsupported protocols and markers", async () => {
    const cast = rec([
      [0, "o", `${ESC}[?1049h${ESC}[?1000h${ESC}[?2004h${ESC}]0;htop\x07${hyperlink("x", "https://x.y")}`],
      [0.1, "o", `${ESC}_Gf=100;AAAA${ESC}\\`],
      [0.2, "m", "chapter:One"],
      [0.3, "o", `${ESC}[?1049l`],
      [0.4, "m", "end"],
    ]);
    const r = await diagnoseRecording(cast, "demo.cast");
    expect(r.features).toMatchObject({ altScreen: true, mouseTracking: true, bracketedPaste: true, hyperlinks: 1, titles: ["htop"] });
    const multi = await diagnoseRecording(rec([[0, "o", "\x1b]0;one\x07mid\x1b]2;two\x1b\\"], [0.4, "m", "end"]]), "titles.cast");
    expect(multi.features.titles).toEqual(["one", "two"]); // several titles inside one chunk all count
    expect(r.unsupported.map((u) => u.name)).toEqual(["kitty-graphics"]);
    expect(r.markers.chapters).toBe(1);
    expect(r.warnings.some((w) => /full-screen program exited/.test(w))).toBe(true); // ?1049h…?1049l flashed by
    expect(r.warnings.some((w) => /Kitty/.test(w))).toBe(false); // unsupported protocols are reported once, not echoed as warnings
  });
});
