export interface Theme {
  name?: string;
  background: string;
  foreground: string;
  cursor?: string;
  cursorAccent?: string;
  selectionBackground?: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

/**
 * A theme name: one of the built-ins (autocompleted) or any of the ~600 Ghostty themes, matched case- and
 * punctuation-insensitively ("Catppuccin Mocha", "catppuccin-mocha", "GitHub Dark" …). `tcut themes` lists them.
 */
export type ThemeName = "catppuccin-mocha" | "dracula" | "github-dark" | "tokyo-night" | "one-dark" | (string & {});

export type ShellName = "bash" | "zsh" | "fish" | "sh";
/** Terminal emulator core: libghostty (full VT, answers queries) or wterm's lite Zig core (faster, fewer features). */
export type CoreName = "ghostty" | "lite";
export type WindowBar = "none" | "colorful" | "colorfulRight" | "rings" | "ringsRight";

/** Duration as milliseconds or a string like "500ms", "1.5s", "2m". */
export type Duration = number | string;

export interface FontConfig {
  /** CSS font-family list. Default: JetBrains Mono → Menlo → monospace. */
  family?: string;
  /** Pixel size. Default 20. */
  size?: number;
  /** Line height multiplier. Default 1.2. */
  lineHeight?: number;
  /** Extra letter spacing in px. Default 0. */
  letterSpacing?: number;
}

export interface KeysConfig {
  position?: "bottom" | "top";
  /** How long a chip stays visible, e.g. "1.2s". */
  ttl?: Duration;
  /** Printable keys pressed within this window merge into one chip. Default "350ms". */
  merge?: Duration;
}

/** A region of the terminal grid to magnify. */
export interface ZoomRegion {
  /** Inclusive row range, 0-based. Default: all rows. */
  rows?: [number, number];
  /** Inclusive column range, 0-based. Default: all columns. */
  cols?: [number, number];
  /** Animation length on the render clock. Default "400ms". */
  duration?: Duration;
  /** Inner padding around the region, in cells. Default 1. */
  padding?: number;
}

/** A browser window recorded next to the terminal (Bun.WebView). */
export interface BrowserConfig {
  /** Page to open when recording starts (may also be opened later with `t.browser.goto`). */
  url?: string;
  /** Pane size in px. Default 720 × the terminal frame height. */
  width?: number;
  height?: number;
  /** How often the page is sampled while recording. Default 10. */
  fps?: number;
  /** Text shown in the browser window's address bar. Default: the current URL. */
  title?: string;
  /**
   * Where the browser window sits: beside/above/below the terminal, or "overlay" — overlapping it like two desktop
   * windows, with `t.focus()` deciding which one is in front. Default "right".
   */
  position?: "right" | "left" | "top" | "bottom" | "overlay";
  /** Overlay only: browser window offset from the terminal window's top-left corner, px. Default ~40%/18% of it. */
  offset?: { x: number; y: number };
}

/** Control of the recorded browser window. */
export interface BrowserSession {
  goto(url: string): Promise<void>;
  /** Wait until the page's visible text matches. */
  waitFor(pattern: RegExp | string, opts?: { timeout?: Duration }): Promise<void>;
  click(selector: string): Promise<void>;
  reload(): Promise<void>;
  evaluate(script: string): Promise<unknown>;
  readonly url: string;
}

export interface CursorConfig {
  /** Default true. Blink is driven by the render clock, so it is deterministic. */
  blink?: boolean;
  /** Full blink period in ms (on + off). Default 1000. */
  period?: number;
}

export interface VideoConfig {
  /**
   * One or more outputs. Extension picks the encoder: .mp4, .webm, .gif, .webp.
   * A path ending in "/" writes a PNG sequence into that directory.
   */
  output: string | string[];
  /** Where to save the .cast recording. Default: next to the first output. */
  cast?: string;

  /** Shell to drive. Named shells get a clean, rc-free, deterministic setup. Default "bash". */
  shell?: ShellName | string[];
  /** Prompt text used for the clean shell setup and for auto-wait in `run()`. Default "> ". */
  prompt?: string;
  /** Override the regex used to detect the prompt on the cursor line. */
  promptPattern?: RegExp;
  cwd?: string;
  env?: Record<string, string>;

  /** Terminal grid. Default 80 × 24 — or derived from `width`/`height` when those are given. */
  cols?: number;
  rows?: number;
  /**
   * Video size in pixels (including margin). When set, the output is exactly this size and the terminal is
   * centred inside; `cols`/`rows` default to what fits.
   */
  width?: number;
  height?: number;
  /** Where looping outputs (GIF, WebP) start: a frame number or a percentage like "50%". */
  loopOffset?: number | string;
  /** Idle compression: at render time, gaps between events longer than this are shortened to this. */
  maxPause?: Duration;
  /** Show recent key presses as chips. `true` = bottom centre, 1.2 s. */
  keys?: boolean | KeysConfig;
  /** A named bundle of defaults applied under explicit settings: readme | x | youtube | square. */
  preset?: "readme" | "x" | "youtube" | "square";

  /** Frames per second of the output. Default 60. */
  fps?: number;
  /** Delay between typed characters. Default "50ms". */
  typingSpeed?: Duration;
  /** 0–1, randomises typing delay by ±jitter using a seeded PRNG (reproducible). Default 0. */
  typingJitter?: number;
  /** Seed for the PRNG used by jitter. Default 1. */
  seed?: number;
  /** Speed multiplier applied at render time. 2 = twice as fast. Default 1. */
  playbackSpeed?: number;
  /** Default timeout for `wait()` / `run()` prompt detection. Default "15s". */
  waitTimeout?: Duration;
  /** Extra still time appended after the script ends. Default "1s". */
  endPause?: Duration;
  /** Snap recorded timestamps up to the next 1/fps boundary so identical output gives identical casts. Default false. */
  quantize?: boolean;
  /** Emulator used for the screen model and rendering. Default "ghostty". */
  core?: CoreName;
  /** Reuse the existing cast when the script and record config are unchanged. Default true. */
  cache?: boolean;

  font?: FontConfig;
  theme?: ThemeName | Theme;
  cursor?: CursorConfig;
  /** Record a browser window beside the terminal. */
  browser?: BrowserConfig;
  /** Padding inside the window, px. Default 24. */
  padding?: number;
  /** Space around the window, px. Default 0. */
  margin?: number;
  /** Colour behind the window (visible when margin > 0). Default: theme background. */
  marginFill?: string;
  /** Rounded corner radius of the window, px. Default 0 (12 is nice with a margin). */
  borderRadius?: number;
  windowBar?: WindowBar;
  /** Title shown in the window bar. */
  title?: string;
}

/** Fully resolved config with every default applied. Serialised into the .cast header. */
export interface ResolvedConfig {
  output: string[];
  cast: string;
  shell: ShellName | string[];
  prompt: string;
  promptPattern: string;
  cwd: string;
  env: Record<string, string>;
  cols: number;
  rows: number;
  width?: number;
  height?: number;
  loopOffset?: number | string;
  maxPause?: number;
  keys?: Required<KeysConfig> & { ttl: number; merge: number };
  fps: number;
  typingSpeed: number;
  typingJitter: number;
  seed: number;
  playbackSpeed: number;
  waitTimeout: number;
  endPause: number;
  quantize: boolean;
  core: CoreName;
  cache: boolean;
  font: Required<FontConfig>;
  theme: Theme;
  cursor: Required<CursorConfig>;
  browser?: Required<Omit<BrowserConfig, "url" | "title" | "offset">> & Pick<BrowserConfig, "url" | "title" | "offset">;
  padding: number;
  margin: number;
  marginFill: string;
  borderRadius: number;
  windowBar: WindowBar;
  title: string;
}

export type KeyName =
  | "enter"
  | "tab"
  | "backspace"
  | "delete"
  | "escape"
  | "space"
  | "up"
  | "down"
  | "left"
  | "right"
  | "home"
  | "end"
  | "pageUp"
  | "pageDown"
  | "insert"
  | `f${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12}`;

export interface WaitOptions {
  /** Match against the cursor line (default) or the whole visible screen. */
  scope?: "line" | "screen";
  timeout?: Duration;
}

export interface TypeOptions {
  /** Per-character delay for this call only. */
  speed?: Duration;
}

export interface RunOptions extends TypeOptions {
  /** What to wait for after pressing Enter. `true` (default) = the prompt, a RegExp = custom, `false` = don't wait. */
  wait?: boolean | RegExp;
  timeout?: Duration;
}

/** The `t` object handed to your script. */
export interface TerminalSession {
  /** Type text with per-character delay. "\n" is sent as Enter. */
  type(text: string, opts?: TypeOptions): Promise<void>;
  /** Type `command`, press Enter, and wait for the prompt to come back. */
  run(command: string, opts?: RunOptions): Promise<void>;
  /** Send text instantly, as if pasted. */
  paste(text: string): Promise<void>;

  key(name: KeyName, times?: number): Promise<void>;
  enter(times?: number): Promise<void>;
  tab(times?: number): Promise<void>;
  backspace(times?: number): Promise<void>;
  delete(times?: number): Promise<void>;
  escape(times?: number): Promise<void>;
  space(times?: number): Promise<void>;
  up(times?: number): Promise<void>;
  down(times?: number): Promise<void>;
  left(times?: number): Promise<void>;
  right(times?: number): Promise<void>;
  home(): Promise<void>;
  end(): Promise<void>;
  pageUp(times?: number): Promise<void>;
  pageDown(times?: number): Promise<void>;
  /** Ctrl+<letter>, e.g. `t.ctrl("c")`. */
  ctrl(letter: string, times?: number): Promise<void>;
  /** Alt/Meta+<key>. */
  alt(key: string, times?: number): Promise<void>;
  /** Shift+<key>: "tab" (back-tab), arrows/home/end/pageUp/pageDown/delete, or a letter (sent uppercase). */
  shift(key: KeyName | string, times?: number): Promise<void>;
  /** Mouse-wheel up/down at the cursor. Only programs with mouse tracking (vim, less --mouse, TUIs) react. */
  scrollUp(times?: number): Promise<void>;
  scrollDown(times?: number): Promise<void>;
  /** Send raw bytes to the PTY. */
  raw(data: string | Uint8Array): Promise<void>;

  sleep(duration: Duration): Promise<void>;
  /** Wait until `pattern` matches the cursor line (or screen). Defaults to the prompt pattern. */
  wait(pattern?: RegExp | string, opts?: WaitOptions): Promise<void>;
  /** Assert that `pattern` matches the screen right now (after output settles). Throws with a screen dump otherwise. */
  expect(pattern: RegExp | string, opts?: Pick<WaitOptions, "scope">): Promise<void>;

  /** Everything inside `fn` happens, but is cut from the video (state changes are kept). */
  hide<T>(fn: () => Promise<T>): Promise<T>;
  /** Save a PNG of the current frame during rendering. */
  screenshot(path: string): Promise<void>;
  /** Insert a named marker (written to the .cast, useful for chapters/tooling). */
  marker(name: string): Promise<void>;
  /** Resize the PTY and the rendered terminal. */
  resize(cols: number, rows: number): Promise<void>;
  /** Shorthand for `run("clear")`. */
  clear(): Promise<void>;
  /**
   * Show Markdown in the terminal as a caption (rendered to ANSI by @wterm/markdown). It is written into the
   * recording and the screen model only, never sent to the shell; afterwards the shell is asked for a fresh prompt.
   * Use at a shell prompt, not inside a full-screen program.
   */
  print(markdown: string): Promise<void>;
  /** A title card: big heading + rule, then a pause (default "1.5s"). */
  title(text: string, opts?: { pause?: Duration }): Promise<void>;
  /** Magnify a region of the terminal (animated at render time); `zoom(null)` resets. */
  zoom(region: ZoomRegion | null): Promise<void>;
  /** Named chapter: becomes mp4 chapter metadata and shows up in `--json` output. */
  chapter(name: string): Promise<void>;
  /** The recorded browser window; throws if `browser` is not configured. */
  readonly browser: BrowserSession;
  /** Overlay layout: bring the terminal or the browser window to the front (recorded as a marker). */
  focus(target: "terminal" | "browser"): Promise<void>;

  /** Current visible screen as text (rows joined by "\n"). */
  screen(): string;
  /** Text of the cursor line. */
  line(): string;
  cursor(): { x: number; y: number };
  readonly cols: number;
  readonly rows: number;
  readonly config: ResolvedConfig;
}

export type Script = (t: TerminalSession) => Promise<void> | void;

/** o = output, i = input, r = resize, m = marker, b = browser frame (path relative to the cast file). */
export type CastEventType = "o" | "i" | "r" | "m" | "b";

export interface BrowserFrame {
  time: number;
  png: Uint8Array;
}
export type CastEvent = [time: number, type: CastEventType, data: string];

export interface CastHeader {
  version: 2;
  width: number;
  height: number;
  timestamp?: number;
  duration?: number;
  title?: string;
  env?: Record<string, string>;
  bunVideo?: ResolvedConfig;
  /** SHA-256 of script source + record config; used for cast caching. */
  scriptHash?: string;
}

export interface Recording {
  header: CastHeader;
  events: CastEvent[];
  /** Absolute path of the cast file this recording was read from / written to; resolves `b` event paths. */
  source?: string;
  /** Browser frames captured during recording, before they are written beside the cast. */
  browserFrames?: BrowserFrame[];
}

export interface RenderProgress {
  frame: number;
  total: number;
}

export interface RenderOptions {
  /** Override resolved config values (theme, font, outputs, …) without re-recording. */
  overrides?: Partial<VideoConfig>;
  onProgress?: (p: RenderProgress) => void;
}

export interface RecordOptions {
  onEvent?: (e: CastEvent) => void;
  log?: (message: string) => void;
  /** Test mode: no typing delay, `sleep()` is a no-op. Timeouts still apply. */
  fast?: boolean;
}
