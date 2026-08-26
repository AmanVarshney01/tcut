import { homedir } from "node:os";
import path from "node:path";
import { applyOverrides } from "./config";
import type { ResolvedConfig, Theme, VideoConfig } from "./types";

// `theme: "auto"` / `font: "auto"`: render with the colours and font of the terminal tcut is running in, so
// the video looks like the user's terminal, not like tcut's default. Colours are asked from the terminal
// itself (OSC 10/11/12/4 — every modern terminal answers) and fall back to the terminal's config file; the
// font has no query protocol, so it always comes from the config of the terminal we can identify.

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);
const OSC = `${ESC}]`;

export interface DetectedFont {
  family: string;
  /** CSS pixels for the renderer (terminal point sizes are converted per platform). */
  size: number;
}

export interface TerminalLook {
  theme?: Theme;
  font?: DetectedFont;
  /** Where it came from, for the status line: "Ghostty", "kitty", "your terminal (OSC)". */
  sources: string[];
  notes: string[];
}

// ---------------------------------------------------------------------------------------------------------
// Colours by asking the terminal

/** `rgb:RRRR/GGGG/BBBB` (16-bit), `rgb:RR/GG/BB`, or `#rrggbb` → `#rrggbb`. */
export function parseOscColor(spec: string): string | null {
  const s = spec.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  const m = /^rgba?:([0-9a-f]{1,4})\/([0-9a-f]{1,4})\/([0-9a-f]{1,4})/i.exec(s);
  if (!m) return null;
  const byte = (v: string): string => {
    const scaled = Math.round((Number.parseInt(v.padEnd(4, v), 16) / 0xffff) * 255);
    return scaled.toString(16).padStart(2, "0");
  };
  return `#${byte(m[1]!)}${byte(m[2]!)}${byte(m[3]!)}`;
}

export interface OscReplies {
  foreground?: string;
  background?: string;
  cursor?: string;
  palette: Map<number, string>;
}

const OSC_SPECIAL = new RegExp(`${ESC}\\](10|11|12);([^${BEL}${ESC}]+)(?:${BEL}|${ESC}\\\\)`, "g");
const OSC_PALETTE = new RegExp(`${ESC}\\]4;(\\d+);([^${BEL}${ESC}]+)(?:${BEL}|${ESC}\\\\)`, "g");
const DA_REPLY = new RegExp(`${ESC}\\[\\?[\\d;]*c`);

export function parseOscReplies(data: string): OscReplies {
  const out: OscReplies = { palette: new Map() };
  for (const m of data.matchAll(OSC_SPECIAL)) {
    const color = parseOscColor(m[2]!);
    if (!color) continue;
    if (m[1] === "10") out.foreground = color;
    else if (m[1] === "11") out.background = color;
    else out.cursor = color;
  }
  for (const m of data.matchAll(OSC_PALETTE)) {
    const color = parseOscColor(m[2]!);
    if (color) out.palette.set(Number(m[1]), color);
  }
  return out;
}

const ANSI_NAMES = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
] as const;

/** A complete Theme from replies, or null when any of foreground, background or the 16 palette entries is missing. */
export function themeFromReplies(r: OscReplies): Theme | null {
  if (!r.foreground || !r.background) return null;
  const colors: Partial<Record<(typeof ANSI_NAMES)[number], string>> = {};
  for (const [i, name] of ANSI_NAMES.entries()) {
    const c = r.palette.get(i);
    if (!c) return null;
    colors[name] = c;
  }
  return { background: r.background, foreground: r.foreground, cursor: r.cursor, ...(colors as Record<(typeof ANSI_NAMES)[number], string>) };
}

export const COLOR_QUERIES = [`${OSC}10;?${BEL}`, `${OSC}11;?${BEL}`, `${OSC}12;?${BEL}`, ...ANSI_NAMES.map((_, i) => `${OSC}4;${i};?${BEL}`), `${ESC}[c`].join("");

/**
 * Ask the terminal on stdin/stdout for its colours. Terminals answer queries in order, so a Device Attributes
 * query at the end tells us the replies are complete; a timeout covers terminals that answer nothing.
 */
export function queryTerminalColors(timeoutMs = 600): Promise<Theme | null> {
  const { stdin, stdout } = process;
  if (process.platform === "win32" || !stdin.isTTY || !stdout.isTTY) return Promise.resolve(null);
  return new Promise((resolve) => {
    let buffer = "";
    let done = false;
    const wasRaw = stdin.isRaw;
    const finish = (): void => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      stdin.off("data", onData);
      stdin.setRawMode(wasRaw);
      stdin.pause();
      resolve(themeFromReplies(parseOscReplies(buffer)));
    };
    const onData = (chunk: Buffer | string): void => {
      buffer += chunk.toString();
      if (DA_REPLY.test(buffer)) finish();
    };
    const timer = setTimeout(finish, timeoutMs);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
    stdout.write(COLOR_QUERIES);
  });
}

// ---------------------------------------------------------------------------------------------------------
// Fonts (and fallback colours) from the terminal's own configuration

/** Terminal point sizes are logical points on macOS (same as CSS px at 1×); elsewhere 1pt = 96/72 px. */
export const pointsToPixels = (pt: number, platform = process.platform): number => (platform === "darwin" ? pt : Math.round(pt * (96 / 72)));

/**
 * iTerm2 stores the PostScript name ("JetBrainsMono-Regular"). Guessing the family from it is unreliable
 * ("JetBrains" is one word); WebKit — the renderer on macOS, where iTerm2 lives — resolves PostScript names as
 * font-family values directly, so the name is passed through as is.
 */
export const familyFromPostScriptName = (name: string): string => name.trim();

export type TerminalProgram = "ghostty" | "kitty" | "alacritty" | "iterm2" | "wezterm" | "windows-terminal" | "vscode" | "apple-terminal" | "unknown";

/** Which terminal this process was started from, by the environment those terminals set. */
export function terminalProgram(env: Record<string, string | undefined> = process.env): TerminalProgram {
  const program = (env.TERM_PROGRAM ?? "").toLowerCase();
  if (program === "ghostty" || env.GHOSTTY_RESOURCES_DIR || env.TERM === "xterm-ghostty") return "ghostty";
  if (program === "iterm.app") return "iterm2";
  if (program === "wezterm" || env.WEZTERM_EXECUTABLE) return "wezterm";
  if (program === "vscode") return "vscode";
  if (program === "apple_terminal") return "apple-terminal";
  if (env.KITTY_WINDOW_ID || env.TERM === "xterm-kitty") return "kitty";
  if (env.ALACRITTY_WINDOW_ID || env.ALACRITTY_SOCKET || env.TERM === "alacritty") return "alacritty";
  if (env.WT_SESSION) return "windows-terminal";
  return "unknown";
}

interface ConfigLook {
  font?: { family?: string; size?: number };
  theme?: Theme;
}

const hexOrNull = (v: string | undefined): string | null => (v && /^#?[0-9a-f]{6}$/i.test(v.trim()) ? `#${v.trim().replace("#", "").toLowerCase()}` : null);

type AnsiName = (typeof ANSI_NAMES)[number];
/** Colours collected from a config file before we know whether they add up to a full theme. */
type ThemeParts = Partial<Record<"background" | "foreground" | "cursor" | AnsiName, string | undefined>>;

function themeFromParts(parts: ThemeParts): Theme | null {
  const { background, foreground } = parts;
  if (!background || !foreground) return null;
  const colors: Partial<Record<(typeof ANSI_NAMES)[number], string>> = {};
  for (const name of ANSI_NAMES) {
    const c = parts[name];
    if (!c) return null;
    colors[name] = c;
  }
  return { background, foreground, cursor: parts.cursor, ...(colors as Record<(typeof ANSI_NAMES)[number], string>) };
}

// Ghostty ----------------------------------------------------------------------------------------------------

export function ghosttyBinary(env: Record<string, string | undefined> = process.env): string | null {
  const onPath = Bun.which("ghostty");
  if (onPath) return onPath;
  const candidates = [
    env.GHOSTTY_RESOURCES_DIR ? path.resolve(env.GHOSTTY_RESOURCES_DIR, "..", "..", "MacOS", "ghostty") : null,
    "/Applications/Ghostty.app/Contents/MacOS/ghostty",
  ];
  for (const c of candidates) if (c && Bun.file(c).size > 0) return c;
  return null;
}

/** `ghostty +show-config` output: `key = value` lines; `font-family` may repeat (fallbacks), the first wins. */
export function parseGhosttyConfig(text: string): ConfigLook {
  const font: { family?: string; size?: number } = {};
  const parts: ThemeParts = {};
  for (const raw of text.split("\n")) {
    const m = /^([a-z-]+)\s*=\s*(.*)$/.exec(raw.trim());
    if (!m) continue;
    const [, key, value] = m;
    const v = value!.trim().replace(/^"(.*)"$/, "$1");
    if (key === "font-family" && font.family === undefined && v) font.family = v;
    else if (key === "font-size") font.size = Number(v);
    else if (key === "background") parts.background = hexOrNull(v) ?? undefined;
    else if (key === "foreground") parts.foreground = hexOrNull(v) ?? undefined;
    else if (key === "cursor-color") parts.cursor = hexOrNull(v) ?? undefined;
    else if (key === "palette") {
      const p = /^(\d+)=(.*)$/.exec(v);
      const index = p ? Number(p[1]) : -1;
      if (p && index >= 0 && index < 16) parts[ANSI_NAMES[index]!] = hexOrNull(p[2]) ?? undefined;
    }
  }
  return { font: { family: font.family ?? "JetBrains Mono", size: font.size }, theme: themeFromParts(parts) ?? undefined };
}

async function ghosttyLook(): Promise<ConfigLook | null> {
  const bin = ghosttyBinary();
  if (!bin) return null;
  const proc = Bun.spawn([bin, "+show-config"], { stdout: "pipe", stderr: "ignore", env: process.env });
  const text = await new Response(proc.stdout).text();
  return parseGhosttyConfig(text);
}

// kitty ------------------------------------------------------------------------------------------------------

/** kitty.conf: `key value` lines, `include other.conf` relative to the file. */
export async function parseKittyConfig(file: string, depth = 0): Promise<ConfigLook> {
  const font: { family?: string; size?: number } = {};
  const parts: ThemeParts = {};
  const f = Bun.file(file);
  if (!(await f.exists())) return {};
  for (const raw of (await f.text()).split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const m = /^(\S+)\s+(.*)$/.exec(line);
    if (!m) continue;
    const [, key, value] = m;
    const v = value!.trim();
    if (key === "include" && depth < 5) {
      const nested = await parseKittyConfig(path.resolve(path.dirname(file), v), depth + 1);
      Object.assign(font, nested.font);
      if (nested.theme) Object.assign(parts, nested.theme);
    } else if (key === "font_family") font.family = v;
    else if (key === "font_size") font.size = Number(v);
    else if (key === "foreground" || key === "background" || key === "cursor") parts[key] = hexOrNull(v) ?? undefined;
    else {
      const c = /^color(\d+)$/.exec(key!);
      const index = c ? Number(c[1]) : -1;
      if (c && index >= 0 && index < 16) parts[ANSI_NAMES[index]!] = hexOrNull(v) ?? undefined;
    }
  }
  return { font, theme: themeFromParts(parts) ?? undefined };
}

// Alacritty --------------------------------------------------------------------------------------------------

interface AlacrittyToml {
  general?: { import?: string[] };
  import?: string[];
  font?: { normal?: { family?: string }; size?: number };
  colors?: { primary?: { background?: string; foreground?: string }; cursor?: { cursor?: string }; normal?: Record<string, string>; bright?: Record<string, string> };
}

export async function parseAlacrittyConfig(file: string, depth = 0): Promise<ConfigLook> {
  const f = Bun.file(file);
  if (!(await f.exists())) return {};
  const toml = Bun.TOML.parse(await f.text()) as AlacrittyToml;
  const merged: ConfigLook = {};
  for (const imported of toml.general?.import ?? toml.import ?? []) {
    if (depth >= 5) break;
    const nested = await parseAlacrittyConfig(imported.replace(/^~/, homedir()), depth + 1);
    merged.font = { ...merged.font, ...nested.font };
    if (nested.theme) merged.theme = nested.theme;
  }
  const font = { ...merged.font };
  if (toml.font?.normal?.family) font.family = toml.font.normal.family;
  if (toml.font?.size !== undefined) font.size = toml.font.size;
  const c = toml.colors;
  if (c) {
    const parts: ThemeParts = { ...merged.theme };
    parts.background = hexOrNull(c.primary?.background) ?? parts.background;
    parts.foreground = hexOrNull(c.primary?.foreground) ?? parts.foreground;
    parts.cursor = hexOrNull(c.cursor?.cursor) ?? parts.cursor;
    for (const [i, name] of ANSI_NAMES.entries()) {
      const source = i < 8 ? c.normal : c.bright;
      const v = hexOrNull(source?.[ANSI_NAMES[i % 8]!]);
      if (v) parts[name] = v;
    }
    merged.theme = themeFromParts(parts) ?? merged.theme;
  }
  return { font, theme: merged.theme };
}

// iTerm2 -----------------------------------------------------------------------------------------------------

interface ITermColor {
  "Red Component"?: number;
  "Green Component"?: number;
  "Blue Component"?: number;
}

export interface ITermProfile {
  Guid?: string;
  "Normal Font"?: string;
  [key: string]: ITermColor | string | number | boolean | undefined;
}

interface ITermPlist {
  "Default Bookmark Guid"?: string;
  "New Bookmarks"?: ITermProfile[];
}

const itermHex = (c: ITermColor | string | number | boolean | undefined): string | undefined => {
  if (!(c instanceof Object)) return undefined;
  const to = (v: number | undefined) => Math.round(Math.min(1, Math.max(0, v ?? 0)) * 255).toString(16).padStart(2, "0");
  return `#${to(c["Red Component"])}${to(c["Green Component"])}${to(c["Blue Component"])}`;
};

export function parseITermPlist(plist: ITermPlist): ConfigLook {
  const profiles = plist["New Bookmarks"] ?? [];
  const profile = profiles.find((p) => p.Guid === plist["Default Bookmark Guid"]) ?? profiles[0];
  if (!profile) return {};
  const font: { family?: string; size?: number } = {};
  const fontSpec = /^(.*)\s+(\d+(?:\.\d+)?)$/.exec(profile["Normal Font"] ?? "");
  if (fontSpec) {
    font.family = familyFromPostScriptName(fontSpec[1]!);
    font.size = Number(fontSpec[2]);
  }
  const parts: ThemeParts = {
    background: itermHex(profile["Background Color"]),
    foreground: itermHex(profile["Foreground Color"]),
    cursor: itermHex(profile["Cursor Color"]),
  };
  for (const [i, name] of ANSI_NAMES.entries()) parts[name] = itermHex(profile[`Ansi ${i} Color`]);
  return { font, theme: themeFromParts(parts) ?? undefined };
}

async function itermLook(): Promise<ConfigLook | null> {
  const plist = path.join(homedir(), "Library", "Preferences", "com.googlecode.iterm2.plist");
  if (!(await Bun.file(plist).exists())) return null;
  const proc = Bun.spawn(["plutil", "-convert", "json", "-o", "-", plist], { stdout: "pipe", stderr: "ignore" });
  const text = await new Response(proc.stdout).text();
  try {
    return parseITermPlist(JSON.parse(text) as ITermPlist);
  } catch {
    return null;
  }
}

// Windows Terminal ---------------------------------------------------------------------------------------------

interface WtProfile {
  guid?: string;
  colorScheme?: string;
  font?: { face?: string; size?: number };
  fontFace?: string;
  fontSize?: number;
}

interface WtSettings {
  defaultProfile?: string;
  profiles?: { defaults?: WtProfile; list?: WtProfile[] };
  schemes?: Array<Record<string, string> & { name?: string }>;
}

export function parseWindowsTerminalSettings(settings: WtSettings): ConfigLook {
  const defaults = settings.profiles?.defaults ?? {};
  const profile = settings.profiles?.list?.find((p) => p.guid === settings.defaultProfile) ?? settings.profiles?.list?.[0] ?? {};
  const family = profile.font?.face ?? profile.fontFace ?? defaults.font?.face ?? defaults.fontFace ?? "Cascadia Mono";
  const size = profile.font?.size ?? profile.fontSize ?? defaults.font?.size ?? defaults.fontSize ?? 12;
  const schemeName = profile.colorScheme ?? defaults.colorScheme;
  const scheme = settings.schemes?.find((s) => s.name === schemeName);
  const wtKey = (name: string) => name.replace("Magenta", "Purple").replace("magenta", "purple");
  const parts: ThemeParts = scheme
    ? { background: hexOrNull(scheme.background) ?? undefined, foreground: hexOrNull(scheme.foreground) ?? undefined, cursor: hexOrNull(scheme.cursorColor) ?? undefined }
    : {};
  if (scheme) for (const name of ANSI_NAMES) parts[name] = hexOrNull(scheme[wtKey(name)]) ?? undefined;
  return { font: { family, size }, theme: themeFromParts(parts) ?? undefined };
}

async function windowsTerminalLook(env: Record<string, string | undefined>): Promise<ConfigLook | null> {
  const local = env.LOCALAPPDATA;
  if (!local) return null;
  for (const pkg of ["Microsoft.WindowsTerminal_8wekyb3d8bbwe", "Microsoft.WindowsTerminalPreview_8wekyb3d8bbwe"]) {
    const file = Bun.file(path.join(local, "Packages", pkg, "LocalState", "settings.json"));
    if (!(await file.exists())) continue;
    try {
      return parseWindowsTerminalSettings(Bun.JSONC.parse(await file.text()) as WtSettings);
    } catch {
      return null;
    }
  }
  return null;
}

// VS Code ------------------------------------------------------------------------------------------------------

interface VsCodeSettings {
  "terminal.integrated.fontFamily"?: string;
  "terminal.integrated.fontSize"?: number;
  "editor.fontFamily"?: string;
  "editor.fontSize"?: number;
}

export function parseVsCodeSettings(settings: VsCodeSettings): ConfigLook {
  const family = settings["terminal.integrated.fontFamily"] || settings["editor.fontFamily"];
  const size = settings["terminal.integrated.fontSize"] ?? settings["editor.fontSize"];
  // the setting is a CSS font-family list; the renderer takes it as is
  return { font: { family: family?.split(",")[0]?.trim().replace(/^['"]|['"]$/g, ""), size } };
}

async function vscodeLook(env: Record<string, string | undefined>): Promise<ConfigLook | null> {
  const home = homedir();
  const candidates =
    process.platform === "darwin"
      ? [path.join(home, "Library", "Application Support", "Code", "User", "settings.json")]
      : process.platform === "win32"
        ? [env.APPDATA ? path.join(env.APPDATA, "Code", "User", "settings.json") : ""]
        : [path.join(home, ".config", "Code", "User", "settings.json")];
  for (const file of candidates.filter(Boolean)) {
    const f = Bun.file(file);
    if (!(await f.exists())) continue;
    try {
      return parseVsCodeSettings(Bun.JSONC.parse(await f.text()) as VsCodeSettings);
    } catch {
      return null;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------

const SOURCE_NAMES = {
  ghostty: "Ghostty",
  kitty: "kitty",
  alacritty: "Alacritty",
  iterm2: "iTerm2",
  wezterm: "WezTerm",
  "windows-terminal": "Windows Terminal",
  vscode: "VS Code",
  "apple-terminal": "Terminal.app",
  unknown: "the terminal",
} satisfies Record<TerminalProgram, string>;

/** The identified terminal's config: font, and colours as a fallback for when the terminal cannot be asked. */
export async function readTerminalConfig(program: TerminalProgram, env: Record<string, string | undefined> = process.env): Promise<ConfigLook | null> {
  const home = homedir();
  switch (program) {
    case "ghostty":
      return ghosttyLook();
    case "kitty":
      return parseKittyConfig(env.KITTY_CONFIG_DIRECTORY ? path.join(env.KITTY_CONFIG_DIRECTORY, "kitty.conf") : path.join(home, ".config", "kitty", "kitty.conf"));
    case "alacritty":
      return parseAlacrittyConfig(path.join(home, ".config", "alacritty", "alacritty.toml"));
    case "iterm2":
      return itermLook();
    case "windows-terminal":
      return windowsTerminalLook(env);
    case "vscode":
      return vscodeLook(env);
    default:
      return null;
  }
}

export interface DetectOptions {
  colors: boolean;
  font: boolean;
  env?: Record<string, string | undefined>;
}

/** Colours from the terminal (or its config), font from its config — whichever of the two were asked for. */
export async function detectTerminalLook(opts: DetectOptions): Promise<TerminalLook> {
  const env = opts.env ?? process.env;
  const program = terminalProgram(env);
  const look: TerminalLook = { sources: [], notes: [] };
  if (opts.colors) {
    const queried = await queryTerminalColors();
    if (queried) {
      look.theme = queried;
      look.sources.push(`colours from ${SOURCE_NAMES[program]}`);
    }
  }
  const needConfig = opts.font || (opts.colors && !look.theme);
  const config = needConfig ? await readTerminalConfig(program, env) : null;
  if (opts.font) {
    if (config?.font?.family) {
      look.font = { family: config.font.family, size: pointsToPixels(config.font.size ?? 13) };
      look.sources.push(`font from ${SOURCE_NAMES[program]}`);
    } else {
      look.notes.push(program === "unknown" ? "could not tell which terminal this is; using the default font" : `could not read the font from ${SOURCE_NAMES[program]}; using the default font`);
    }
  }
  if (opts.colors && !look.theme) {
    if (config?.theme) {
      look.theme = config.theme;
      look.sources.push(`colours from ${SOURCE_NAMES[program]}'s config`);
    } else {
      look.notes.push("could not read the terminal's colours; using the default theme");
    }
  }
  return look;
}

/**
 * Resolve `theme: "auto"` / `font: "auto"` against the terminal tcut runs in. The result carries concrete values
 * (and `detected` flags), so the recording's header reproduces the look on every later render.
 */
export async function applyTerminalLook(config: ResolvedConfig, log?: (message: string) => void): Promise<ResolvedConfig> {
  if (!config.auto.theme && !config.auto.font) return config;
  const look = await detectTerminalLook({ colors: config.auto.theme, font: config.auto.font });
  const overrides: Partial<VideoConfig> = {};
  if (look.theme) overrides.theme = look.theme;
  if (look.font) overrides.font = { family: look.font.family, size: look.font.size };
  const applied = applyOverrides(config, overrides);
  const summary = [look.theme ? "your terminal's colours" : null, look.font ? `${look.font.family} ${look.font.size}px` : null].filter(Boolean).join(" · ");
  if (summary) log?.(`look: ${summary} (${look.sources.join(", ")})`);
  for (const note of look.notes) log?.(`note: ${note}`);
  return { ...applied, auto: { theme: false, font: false }, detected: { theme: config.auto.theme && Boolean(look.theme), font: config.auto.font && Boolean(look.font) } };
}
