import { MarkdownRenderer } from "@wterm/markdown";
import { startBrowserCapture, type BrowserCapture } from "./browser";
import { MARKER } from "./cast";
import { toMs } from "./duration";
import { ExpectationError, MissingRequirementError, WaitTimeoutError } from "./errors";
import { altSequence, ctrlSequence, keySequence, shiftSequence, wheelSequence } from "./keys";
import { linkifyMarkdown } from "./osc";
import { Screen } from "./screen";
import type {
  BrowserSession,
  CastEvent,
  Duration,
  KeyName,
  RecordOptions,
  Recording,
  ResolvedConfig,
  RunOptions,
  Script,
  TerminalSession,
  TypeOptions,
  WaitOptions,
} from "./types";

export { WaitTimeoutError, ExpectationError, MissingRequirementError } from "./errors";

/** Deterministic PRNG (mulberry32) so typing jitter is reproducible. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface ShellSetup {
  cmd: string[];
  env: Record<string, string>;
}

/** Command + environment for a clean, rc-free shell with the configured prompt. */
export function shellSetup(config: ResolvedConfig): ShellSetup {
  const { shell, prompt } = config;
  if (Array.isArray(shell)) return { cmd: shell, env: {} };
  switch (shell) {
    case "bash":
      return {
        cmd: ["bash", "--norc", "--noprofile"],
        env: {
          PS1: prompt,
          PS2: "",
          HISTFILE: "/dev/null",
          BASH_SILENCE_DEPRECATION_WARNING: "1",
        },
      };
    case "zsh":
      return {
        cmd: ["zsh", "-f"],
        env: { PS1: prompt, PROMPT: prompt, PS2: "", HISTFILE: "/dev/null", PROMPT_EOL_MARK: "" },
      };
    case "fish": {
      const escaped = prompt.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      return {
        cmd: [
          "fish",
          "--no-config",
          "--init-command",
          `function fish_prompt; printf '%s' '${escaped}'; end; function fish_greeting; end; set -g fish_autosuggestion_enabled 0`,
        ],
        env: {},
      };
    }
    case "sh":
      return { cmd: ["sh"], env: { PS1: prompt, PS2: "" } };
    default:
      return { cmd: [shell], env: { PS1: prompt } };
  }
}

let cachedLang: string | null = null;

/**
 * A UTF-8 locale the shell can actually switch to. A LANG naming a locale that is not installed (en_US.UTF-8 on a
 * minimal Debian, say) silently drops bash into the C locale, where readline mangles multi-byte input such as emoji.
 */
export function defaultLang(): string {
  if (cachedLang !== null) return cachedLang;
  const current = process.env.LANG ?? "";
  const available = new Set<string>();
  try {
    const proc = Bun.spawnSync(["locale", "-a"], { stdout: "pipe", stderr: "ignore" });
    for (const line of proc.stdout.toString().split("\n")) available.add(line.trim().toLowerCase().replace("utf8", "utf-8"));
  } catch {
    /* no `locale` binary: keep the first candidate */
  }
  const has = (name: string) => available.size === 0 || available.has(name.toLowerCase());
  const candidates = [current, "C.UTF-8", "en_US.UTF-8"].filter((c) => /utf-?8/i.test(c));
  cachedLang = candidates.find(has) ?? candidates[candidates.length - 1] ?? "C.UTF-8";
  return cachedLang;
}

/** Drives a Bun.Terminal PTY according to a script and produces an asciicast recording. */
export async function record(config: ResolvedConfig, script: Script, opts: RecordOptions = {}): Promise<Recording> {
  const log = opts.log ?? (() => {});
  const missing = config.requires.filter((name) => Bun.which(name) === null);
  if (missing.length > 0) throw new MissingRequirementError(missing);
  const events: CastEvent[] = [];
  const screen = await Screen.create(config.cols, config.rows, { core: config.core });
  const fast = opts.fast === true;
  const decoder = new TextDecoder("utf-8");
  const rand = mulberry32(config.seed);
  const promptPattern = new RegExp(config.promptPattern);

  let startedAt: number | null = null;
  let hiddenDepth = 0;
  let cols = config.cols;
  let rows = config.rows;

  const now = (): number => (startedAt === null ? 0 : (performance.now() - startedAt) / 1000);
  const stamp = (): number => {
    const t = now();
    if (!config.quantize) return Number(t.toFixed(6));
    return Math.ceil(t * config.fps - 1e-6) / config.fps;
  };
  const push = (type: CastEvent[1], data: string): void => {
    const event: CastEvent = [stamp(), type, data];
    events.push(event);
    opts.onEvent?.(event);
  };

  const setup = shellSetup(config);
  const { PROMPT_COMMAND: _userPromptCommand, ...inheritedEnv } = process.env; // a user PROMPT_COMMAND would repaint over the clean prompt
  const env = {
    ...inheritedEnv,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    LANG: defaultLang(),
    ...setup.env,
    ...config.env,
  };

  let exited = false;
  const proc = Bun.spawn(setup.cmd, {
    cwd: config.cwd,
    env,
    terminal: {
      cols,
      rows,
      name: "xterm-256color",
      data(_terminal, chunk) {
        const text = decoder.decode(chunk, { stream: true });
        if (!text) return;
        push("o", text);
        screen.write(text);
      },
      exit() {
        exited = true;
      },
    },
  });
  const terminal = proc.terminal;
  if (!terminal) throw new Error("Bun.spawn did not return a terminal. Is this Bun >= 1.4?");
  // Programs that query the terminal (DA, cursor position, …) need the emulator's answer written back.
  screen.onResponse = (response) => {
    if (!exited && !terminal.closed) terminal.write(response);
  };

  // Optional browser pane (shared with live recording): a WebView sampled on the recording clock.
  const browserSession: BrowserCapture | null = config.browser ? startBrowserCapture(config, stamp, log) : null;

  const sleep = async (duration: Duration): Promise<void> => {
    const ms = toMs(duration);
    if (fast) return;
    await Bun.sleep(ms);
  };

  const ensureAlive = (): void => {
    if (exited || terminal.closed) {
      throw new Error(`The shell exited before the script finished.\n\n--- screen ---\n${screen.screen()}\n--------------`);
    }
  };

  const raw = async (data: string | Uint8Array): Promise<void> => {
    ensureAlive();
    terminal.write(data);
    push("i", data instanceof Uint8Array ? decoder.decode(data) : data);
  };

  /** Put text on screen as if the terminal had printed it: into the cast and the screen model, not the PTY. */
  const inject = (data: string): void => {
    push("o", data);
    screen.write(data);
  };

  const renderMarkdown = (markdown: string): string => {
    const renderer = new MarkdownRenderer({ width: Math.max(20, cols - 2) });
    const linked = linkifyMarkdown(markdown);
    return renderer.push(linked.endsWith("\n") ? linked : linked + "\n") + renderer.flush();
  };

  const print = async (markdown: string): Promise<void> => {
    await screen.settle();
    // Clear the prompt line, show the caption, then ask the shell for a fresh prompt on the next line.
    inject(`\r\x1b[K${renderMarkdown(markdown)}`);
    await raw("\r");
    await waitFor(`prompt ${promptPattern} after print()`, promptVisible, config.waitTimeout);
  };

  const title = async (text: string, titleOpts: { pause?: Duration } = {}): Promise<void> => {
    await print(`# ${text}\n\n---`);
    await sleep(titleOpts.pause ?? "1.5s");
  };

  const typingDelay = (base: number): number => {
    if (config.typingJitter === 0) return base;
    const factor = 1 + (rand() * 2 - 1) * config.typingJitter;
    return Math.max(0, base * factor);
  };

  const type = async (text: string, typeOpts: TypeOptions = {}): Promise<void> => {
    const speed = fast ? 0 : toMs(typeOpts.speed, config.typingSpeed);
    for (const char of text) {
      await raw(char === "\n" ? "\r" : char);
      if (speed > 0) await Bun.sleep(typingDelay(speed));
    }
  };

  const pressKey = async (sequence: string, times = 1): Promise<void> => {
    for (let i = 0; i < times; i++) {
      await raw(sequence);
      if (!fast && config.typingSpeed > 0 && times > 1) await Bun.sleep(typingDelay(config.typingSpeed));
    }
  };

  const key = (name: KeyName, times = 1): Promise<void> => pressKey(keySequence(name, { appCursor: screen.cursorKeysApp() }), times);

  /** Bracketed paste when the program asked for it, so editors treat the text as a paste (no auto-indent storms). */
  const paste = async (text: string): Promise<void> => {
    await screen.settle();
    await raw(screen.bracketedPaste() ? `\x1b[200~${text}\x1b[201~` : text);
  };

  const scroll = async (direction: "up" | "down", times: number): Promise<void> => {
    await screen.settle();
    if (screen.mouseTracking() === 0) {
      log(`scroll${direction === "up" ? "Up" : "Down"}: the program has not enabled mouse tracking, so there is nothing to scroll — skipped`);
      return;
    }
    const { x, y } = screen.cursor();
    for (let i = 0; i < times; i++) {
      await raw(wheelSequence(direction, x + 1, y + 1));
      if (!fast && times > 1) await Bun.sleep(40);
    }
  };

  const matches = (pattern: RegExp, scope: "line" | "screen" | "scrollback"): boolean =>
    pattern.test(scope === "scrollback" ? screen.transcript() : scope === "screen" ? screen.screen() : screen.line());

  const toRegExp = (pattern: RegExp | string): RegExp =>
    pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

  const waitFor = async (
    description: string,
    test: () => boolean,
    timeoutMs: number,
  ): Promise<void> => {
    const deadline = performance.now() + timeoutMs;
    for (;;) {
      await screen.settle();
      if (test()) return;
      if (exited) {
        await screen.settle();
        if (test()) return;
        throw new Error(`Shell exited while waiting for ${description}.\n\n--- screen ---\n${screen.screen()}\n--------------`);
      }
      const remaining = deadline - performance.now();
      if (remaining <= 0) throw new WaitTimeoutError(description, timeoutMs, screen.screen());
      await Promise.race([screen.nextFlush(), Bun.sleep(Math.min(remaining, 50))]);
    }
  };

  // The prompt is whatever sits left of the cursor; text to the right may be residue from a TUI that exited.
  const promptVisible = (): boolean => promptPattern.test(screen.lineToCursor());

  const wait = async (pattern?: RegExp | string, waitOpts: WaitOptions = {}): Promise<void> => {
    const timeout = toMs(waitOpts.timeout, config.waitTimeout);
    if (pattern === undefined) {
      await waitFor(`prompt ${promptPattern}`, promptVisible, timeout);
      return;
    }
    const regex = toRegExp(pattern);
    const scope = waitOpts.scope ?? "line";
    await waitFor(`${regex} on ${scope}`, () => matches(regex, scope), timeout);
  };

  const waitForPrompt = async (afterLine: number, echoLine: string, timeoutMs: number): Promise<void> => {
    await waitFor(
      `prompt ${promptPattern}`,
      () => promptVisible() && (screen.absoluteCursorLine() !== afterLine || screen.lineToCursor() !== echoLine),
      timeoutMs,
    );
  };

  const run = async (command: string, runOpts: RunOptions = {}): Promise<void> => {
    await type(command, runOpts);
    await screen.settle();
    const beforeLine = screen.absoluteCursorLine();
    const echoLine = screen.lineToCursor();
    await raw("\r");
    const timeout = toMs(runOpts.timeout, config.waitTimeout);
    if (runOpts.wait === false) return;
    if (runOpts.wait instanceof RegExp) {
      await wait(runOpts.wait, { timeout });
      return;
    }
    await waitForPrompt(beforeLine, echoLine, timeout);
  };

  const expect = async (pattern: RegExp | string, expectOpts: Pick<WaitOptions, "scope"> = {}): Promise<void> => {
    await screen.settle();
    const regex = toRegExp(pattern);
    const scope = expectOpts.scope ?? "screen";
    if (!matches(regex, scope)) throw new ExpectationError(`${regex} on ${scope}`, screen.screen());
  };

  const hide = async <T>(fn: () => Promise<T>): Promise<T> => {
    if (hiddenDepth === 0) push("m", MARKER.hide);
    hiddenDepth++;
    try {
      return await fn();
    } finally {
      hiddenDepth--;
      if (hiddenDepth === 0) {
        await screen.settle();
        push("m", MARKER.show);
      }
    }
  };

  const speedStack: number[] = [];
  const timelapse = async <T>(fn: () => Promise<T>, tlOpts: { speed?: number } = {}): Promise<T> => {
    const speed = tlOpts.speed ?? 8;
    if (!(speed > 0)) throw new Error(`timelapse speed must be greater than 0, got ${speed}`);
    await screen.settle();
    speedStack.push(speed);
    push("m", `${MARKER.speed}${speed}`);
    try {
      return await fn();
    } finally {
      await screen.settle();
      speedStack.pop();
      push("m", `${MARKER.speed}${speedStack[speedStack.length - 1] ?? 1}`);
    }
  };

  const session: TerminalSession = {
    type,
    run,
    paste,
    key,
    enter: (n) => key("enter", n),
    tab: (n) => key("tab", n),
    backspace: (n) => key("backspace", n),
    delete: (n) => key("delete", n),
    escape: (n) => key("escape", n),
    space: (n) => key("space", n),
    up: (n) => key("up", n),
    down: (n) => key("down", n),
    left: (n) => key("left", n),
    right: (n) => key("right", n),
    home: () => key("home"),
    end: () => key("end"),
    pageUp: (n) => key("pageUp", n),
    pageDown: (n) => key("pageDown", n),
    ctrl: (letter, n) => pressKey(ctrlSequence(letter), n),
    alt: (k, n) => pressKey(altSequence(k), n),
    shift: (k, n) => pressKey(shiftSequence(k), n),
    scrollUp: (n) => scroll("up", n ?? 1),
    scrollDown: (n) => scroll("down", n ?? 1),
    raw,
    sleep,
    wait,
    expect,
    hide,
    timelapse,
    screenshot: async (file) => {
      await screen.settle();
      push("m", MARKER.screenshot + file);
    },
    marker: async (name) => {
      push("m", name);
    },
    resize: async (newCols, newRows) => {
      ensureAlive();
      cols = newCols;
      rows = newRows;
      terminal.resize(newCols, newRows);
      screen.resize(newCols, newRows);
      push("r", `${newCols}x${newRows}`);
      await screen.settle();
    },
    clear: () => run("clear"),
    print,
    title,
    get browser(): BrowserSession {
      if (!browserSession) throw new Error("t.browser needs `browser: { url }` in the video config.");
      return browserSession;
    },
    focus: async (target) => {
      await screen.settle();
      push("m", `${MARKER.focus}${target}`);
    },
    zoom: async (region) => {
      await screen.settle();
      push("m", `${MARKER.zoom}${region ? JSON.stringify({ ...region, duration: region.duration === undefined ? undefined : toMs(region.duration) }) : "null"}`);
    },
    chapter: async (name) => {
      await screen.settle();
      push("m", `${MARKER.chapter}${name}`);
    },
    screen: () => screen.screen(),
    scrollback: () => screen.transcript(),
    line: () => screen.line(),
    cursor: () => screen.cursor(),
    get cols() {
      return cols;
    },
    get rows() {
      return rows;
    },
    config,
  };

  try {
    // Everything that happens before the first prompt is stamped at t=0.
    log(`starting ${Array.isArray(config.shell) ? config.shell.join(" ") : config.shell}`);
    // Named shells get a known prompt; for an arbitrary command there is nothing to wait for — start at once.
    if (!Array.isArray(config.shell)) {
      await waitFor(`initial prompt ${promptPattern}`, promptVisible, config.waitTimeout);
    }
    startedAt = performance.now();
    log("recording");
    await script(session);
    if (hiddenDepth > 0) throw new Error("Script finished inside hide() — this is a bug in the recorder");
    await screen.settle();
    if (config.endPause > 0 && !fast) await Bun.sleep(config.endPause);
    push("m", MARKER.end);
  } finally {
    await browserSession?.stop();
    try {
      terminal.close();
    } catch {
      /* already closed */
    }
    if (!exited) proc.kill();
    await proc.exited.catch(() => undefined);
    screen.dispose();
  }

  const duration = events.length > 0 ? events[events.length - 1]![0] : 0;
  return {
    header: {
      version: 2,
      width: config.cols,
      height: config.rows,
      timestamp: Math.floor(Date.now() / 1000),
      duration,
      title: config.title || undefined,
      env: { TERM: "xterm-256color", SHELL: Array.isArray(config.shell) ? config.shell[0]! : config.shell },
      bunVideo: config,
    },
    events,
    ...(browserSession && { browserFrames: browserSession.frames }),
  };
}
