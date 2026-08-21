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
  test("the recorder follows the program's modes", async () => {
    // Keys go to `read`, not to the shell prompt (readline would treat an arrow as history recall). One command
    // line drives all three reads so no prompt redraw sits between them.
    const out = await record(resolveConfig({ output: `${dir}/x.mp4`, cols: 70, rows: 12, endPause: 0, typingSpeed: 0 }), async (t) => {
      await t.type(
        "printf '\\033[?1h\\033[?2004h'; IFS= read -rs -n3 a; printf 'A=%q\\n' \"$a\"; IFS= read -rs -n18 b; printf 'B=%q\\n' \"$b\"; printf '\\033[?1l\\033[?2004l'; IFS= read -rs -n3 c; printf 'C=%q\\n' \"$c\"\n",
      );
      await t.sleep(300);
      await t.up();
      await t.wait(/A=\$'\\EOA'/, { scope: "screen" });
      await t.paste("pasted"); // ESC[200~ + pasted + ESC[201~ = 18 bytes
      await t.wait(/B=.*200~pasted.*201~/, { scope: "screen" });
      await t.down();
      await t.wait(/C=\$'\\E\[B'/, { scope: "screen" });
    });
    const inputs = out.events.filter((e) => e[1] === "i").map((e) => e[2]);
    expect(inputs).toContain(`${ESC}OA`);
    expect(inputs).toContain(`${ESC}[200~pasted${ESC}[201~`);
    expect(inputs).toContain(`${ESC}[B`);
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
    expect(r.unsupported.map((u) => u.name)).toEqual(["kitty-graphics"]);
    expect(r.markers.chapters).toBe(1);
    expect(r.warnings.some((w) => /Kitty/.test(w))).toBe(true);
  });
});
