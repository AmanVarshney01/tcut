import { describe, expect, test } from "bun:test";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fontFamilies, fontStack, resolveConfig } from "../src/config";
import {
  COLOR_QUERIES,
  familyFromPostScriptName,
  parseAlacrittyConfig,
  type ITermProfile,
  parseGhosttyConfig,
  parseITermPlist,
  parseKittyConfig,
  parseOscColor,
  parseOscReplies,
  parseVsCodeSettings,
  parseWindowsTerminalSettings,
  pointsToPixels,
  terminalProgram,
  themeFromReplies,
} from "../src/terminallook";

const ESC = "\x1b";
const BEL = "\x07";
const dir = "/tmp/tcut-terminallook-test";

/** What a terminal answers to tcut's colour queries: a full palette, in order, then Device Attributes. */
const reply = (bg: string, fg: string): string => {
  const rgb = (hex: string) => `rgb:${hex.slice(1, 3)}${hex.slice(1, 3)}/${hex.slice(3, 5)}${hex.slice(3, 5)}/${hex.slice(5, 7)}${hex.slice(5, 7)}`;
  const palette = Array.from({ length: 16 }, (_, i) => `${ESC}]4;${i};${rgb(`#${(i * 16).toString(16).padStart(2, "0")}1122`)}${BEL}`).join("");
  return `${ESC}]10;${rgb(fg)}${BEL}${ESC}]11;${rgb(bg)}${ESC}\\${ESC}]12;${rgb("#f5e0dc")}${BEL}${palette}${ESC}[?62;22c`;
};

describe("terminal look", () => {
  test("OSC colour replies parse into a theme", () => {
    expect(parseOscColor("rgb:1e1e/1e1e/2e2e")).toBe("#1e1e2e");
    expect(parseOscColor("rgb:1e/1e/2e")).toBe("#1e1e2e");
    expect(parseOscColor("#ABCDEF")).toBe("#abcdef");
    expect(parseOscColor("nonsense")).toBeNull();
    const theme = themeFromReplies(parseOscReplies(reply("#1e1e2e", "#cdd6f4")));
    expect(theme?.background).toBe("#1e1e2e");
    expect(theme?.foreground).toBe("#cdd6f4");
    expect(theme?.cursor).toBe("#f5e0dc");
    expect(theme?.black).toBe("#001122");
    expect(theme?.brightWhite).toBe("#f01122");
    // an incomplete palette is not a theme
    expect(themeFromReplies(parseOscReplies(`${ESC}]10;rgb:ff/ff/ff${BEL}${ESC}]11;rgb:00/00/00${BEL}`))).toBeNull();
  });

  test("queries end with Device Attributes so the reply stream has a known end", () => {
    expect(COLOR_QUERIES.endsWith(`${ESC}[c`)).toBe(true);
    expect(COLOR_QUERIES).toContain(`${ESC}]4;15;?${BEL}`);
  });

  test("the terminal is identified from what it puts in the environment", () => {
    expect(terminalProgram({ TERM_PROGRAM: "ghostty" })).toBe("ghostty");
    expect(terminalProgram({ TERM: "xterm-ghostty" })).toBe("ghostty");
    expect(terminalProgram({ TERM_PROGRAM: "iTerm.app" })).toBe("iterm2");
    expect(terminalProgram({ KITTY_WINDOW_ID: "1" })).toBe("kitty");
    expect(terminalProgram({ ALACRITTY_SOCKET: "/tmp/x" })).toBe("alacritty");
    expect(terminalProgram({ WT_SESSION: "abc" })).toBe("windows-terminal");
    expect(terminalProgram({ TERM_PROGRAM: "vscode" })).toBe("vscode");
    expect(terminalProgram({})).toBe("unknown");
  });

  test("ghostty +show-config: font, size, and the palette as a fallback theme", () => {
    const look = parseGhosttyConfig(`font-family = "Berkeley Mono"\nfont-family = Symbols Nerd Font\nfont-size = 18\ntheme = vague\nbackground = #141415\nforeground = #cdcdcd\ncursor-color = #cdcdcd\n${Array.from({ length: 16 }, (_, i) => `palette = ${i}=#${(i + 1).toString(16).padStart(2, "0")}0000`).join("\n")}\npalette = 16=#000000\n`);
    expect(look.font).toEqual({ family: "Berkeley Mono", size: 18 });
    expect(look.theme?.background).toBe("#141415");
    expect(look.theme?.red).toBe("#020000");
    expect(look.theme?.brightWhite).toBe("#100000");
    // no font-family line → Ghostty's bundled default
    expect(parseGhosttyConfig("font-size = 13\n").font).toEqual({ family: "JetBrains Mono", size: 13 });
  });

  test("kitty.conf with an include", async () => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    await Bun.write(path.join(dir, "theme.conf"), `foreground #cdd6f4\nbackground #1e1e2e\n${Array.from({ length: 16 }, (_, i) => `color${i} #${i.toString(16).padStart(2, "0")}aabb`).join("\n")}\n`);
    await Bun.write(path.join(dir, "kitty.conf"), "# comment\nfont_family Fira Code\nfont_size 14.0\ninclude theme.conf\n");
    const look = await parseKittyConfig(path.join(dir, "kitty.conf"));
    expect(look.font).toEqual({ family: "Fira Code", size: 14 });
    expect(look.theme?.background).toBe("#1e1e2e");
    expect(look.theme?.brightWhite).toBe("#0faabb");
  });

  test("alacritty.toml with an import", async () => {
    await Bun.write(path.join(dir, "colors.toml"), `[colors.primary]\nbackground = "#282a36"\nforeground = "#f8f8f2"\n[colors.normal]\nblack = "#000000"\nred = "#ff5555"\ngreen = "#50fa7b"\nyellow = "#f1fa8c"\nblue = "#bd93f9"\nmagenta = "#ff79c6"\ncyan = "#8be9fd"\nwhite = "#bfbfbf"\n[colors.bright]\nblack = "#4d4d4d"\nred = "#ff6e6e"\ngreen = "#69ff94"\nyellow = "#ffffa5"\nblue = "#d6acff"\nmagenta = "#ff92df"\ncyan = "#a4ffff"\nwhite = "#ffffff"\n`);
    // a TOML literal string: a Windows path's backslashes must not be read as escapes
    await Bun.write(path.join(dir, "alacritty.toml"), `[general]\nimport = ['${path.join(dir, "colors.toml")}']\n[font]\nsize = 12\n[font.normal]\nfamily = "Iosevka"\n`);
    const look = await parseAlacrittyConfig(path.join(dir, "alacritty.toml"));
    expect(look.font).toEqual({ family: "Iosevka", size: 12 });
    expect(look.theme?.background).toBe("#282a36");
    expect(look.theme?.brightMagenta).toBe("#ff92df");
  });

  test("iTerm2 profile: PostScript font name and float colour components", () => {
    const color = (r: number, g: number, b: number) => ({ "Red Component": r, "Green Component": g, "Blue Component": b });
    const profile: ITermProfile = { Guid: "A", "Normal Font": "JetBrainsMono-Regular 13", "Background Color": color(0, 0, 0), "Foreground Color": color(1, 1, 1), "Cursor Color": color(1, 0, 0) };
    for (let i = 0; i < 16; i++) profile[`Ansi ${i} Color`] = color(i / 15, 0, 0);
    const look = parseITermPlist({ "Default Bookmark Guid": "A", "New Bookmarks": [profile] });
    // the PostScript name is a valid font-family for WebKit; guessing "JetBrains Mono" from it is not reliable
    expect(look.font).toEqual({ family: "JetBrainsMono-Regular", size: 13 });
    expect(look.theme?.foreground).toBe("#ffffff");
    expect(look.theme?.brightWhite).toBe("#ff0000");
    expect(familyFromPostScriptName(" Menlo-Regular ")).toBe("Menlo-Regular");
  });

  test("Windows Terminal settings: default profile, defaults, named scheme", () => {
    const names = ["black", "red", "green", "yellow", "blue", "purple", "cyan", "white"];
    const scheme = {
      name: "One Half Dark",
      background: "#282C34",
      foreground: "#DCDFE4",
      cursorColor: "#FFFFFF",
      ...Object.fromEntries(names.flatMap((k) => [[k, "#111111"], [`bright${k[0]!.toUpperCase()}${k.slice(1)}`, "#eeeeee"]])),
    };
    const look = parseWindowsTerminalSettings({
      defaultProfile: "{b}",
      profiles: { defaults: { font: { face: "Cascadia Code", size: 11 } }, list: [{ guid: "{a}", colorScheme: "Campbell" }, { guid: "{b}", colorScheme: "One Half Dark" }] },
      schemes: [scheme],
    });
    expect(look.font).toEqual({ family: "Cascadia Code", size: 11 });
    expect(look.theme?.background).toBe("#282c34");
    expect(look.theme?.brightMagenta).toBe("#eeeeee");
  });

  test("VS Code: terminal font, falling back to the editor font", () => {
    expect(parseVsCodeSettings({ "terminal.integrated.fontFamily": "'MonoLisa', monospace", "terminal.integrated.fontSize": 13 }).font).toEqual({ family: "MonoLisa", size: 13 });
    expect(parseVsCodeSettings({ "editor.fontFamily": "Menlo", "editor.fontSize": 12 }).font).toEqual({ family: "Menlo", size: 12 });
  });

  test("the render font stack falls back to Nerd Font symbols like a terminal does", () => {
    const stack = fontStack("JetBrains Mono");
    expect(stack.startsWith('"JetBrains Mono", "JetBrains Mono Nerd Font Mono", "JetBrainsMono Nerd Font Mono"')).toBe(true);
    expect(stack).toContain('"Symbols Nerd Font Mono"');
    expect(stack.endsWith("monospace")).toBe(true);
    // a configured list keeps its order; a Nerd Font first needs no variants; nothing is listed twice
    expect(fontStack('"Fira Code", Menlo')).toMatch(/^"Fira Code", Menlo, "Fira Code Nerd Font Mono"/);
    expect(fontStack("JetBrainsMono Nerd Font Mono")).not.toContain("Nerd Font Mono Nerd Font");
    expect(fontFamilies(fontStack("Menlo")).filter((f) => f === "Menlo")).toHaveLength(1);
  });

  test("points become pixels per platform", () => {
    expect(pointsToPixels(18, "darwin")).toBe(18);
    expect(pointsToPixels(12, "linux")).toBe(16);
  });

  test('config accepts theme: "auto" and font: "auto" and remembers to resolve them later', () => {
    const c = resolveConfig({ output: "x.mp4", theme: "auto", font: "auto" });
    expect(c.auto).toEqual({ theme: true, font: true });
    expect(c.theme.name).toBe("catppuccin-mocha"); // placeholder until applyTerminalLook runs
    expect(resolveConfig({ output: "x.mp4" }).auto).toEqual({ theme: false, font: false });
  });

  test("queryTerminalColors: asks a real PTY and reads the answers back", async () => {
    if (process.platform === "win32") return;
    // A child process runs the query inside a PTY; this test plays the terminal and answers.
    let transcript = "";
    const child = Bun.spawn(["bun", "-e", 'import { queryTerminalColors } from "./src/terminallook"; const t = await queryTerminalColors(3000); console.log(JSON.stringify(t));'], {
      cwd: path.resolve(import.meta.dir, ".."),
      terminal: {
        cols: 200,
        rows: 24,
        name: "xterm-256color",
        data(term, chunk) {
          const text = new TextDecoder().decode(chunk);
          transcript += text;
          if (text.includes(`${ESC}[c`)) term.write(reply("#0b0d12", "#e6e9ee"));
        },
      },
    });
    await child.exited;
    // everything the child printed came through the PTY, on the same line as the query bytes it wrote
    const json = /\{[^\n]*\}/.exec(transcript)?.[0];
    expect(json).toBeDefined();
    const theme = JSON.parse(json!) as { background: string; foreground: string; brightWhite: string };
    expect(theme.background).toBe("#0b0d12");
    expect(theme.foreground).toBe("#e6e9ee");
    expect(theme.brightWhite).toBe("#f01122");
  }, 15_000);
});
