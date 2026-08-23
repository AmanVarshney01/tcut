import { startBrowserCapture } from "./browser";
import { MARKER } from "./cast";
import { shellSetup } from "./recorder";
import { CURSOR_QUERY, hasCursorReport, stripTerminalReplies } from "./replies";
import type { CastEvent, Recording, ResolvedConfig } from "./types";

/** What live recording needs from a keystroke source: `process.stdin`, or any readable stream (a PassThrough in tests). */
export interface LiveStdin {
  isTTY?: boolean;
  setRawMode?(mode: boolean): unknown;
  resume(): unknown;
  pause(): unknown;
  on(event: "data", listener: (chunk: Buffer | string) => void): unknown;
  off(event: "data", listener: (chunk: Buffer | string) => void): unknown;
}

export interface LiveOptions {
  /** Run this command instead of the configured clean shell. */
  command?: string[];
  /** Terminal size; defaults to the size of the terminal tcut is running in, then the config. */
  cols?: number;
  rows?: number;
  /** Where to mirror the session (default: this process's stdout). */
  stdout?: { write(data: Uint8Array | string): unknown };
  /** Keystroke source (default: this process's stdin, switched to raw mode when it is a TTY). */
  stdin?: LiveStdin | null;
  log?: (message: string) => void;
  /** How to name the command in status lines (defaults to the argv). */
  describe?: string;
}

/**
 * Record a *live* session: the user (or a pipe) drives the PTY, tcut mirrors it to the terminal and captures
 * every byte with timestamps. No script, no waits — whatever happened is what gets rendered.
 */
export async function recordLive(config: ResolvedConfig, opts: LiveOptions = {}): Promise<Recording> {
  const log = opts.log ?? (() => {});
  const stdin = opts.stdin === undefined ? process.stdin : opts.stdin;
  const stdout = opts.stdout ?? { write: (d: Uint8Array | string) => process.stdout.write(d) };
  const cols = opts.cols ?? process.stdout.columns ?? config.cols;
  const rows = opts.rows ?? process.stdout.rows ?? config.rows;
  const decoder = new TextDecoder("utf-8");
  const events: CastEvent[] = [];
  const startedAt = performance.now();

  const stampAt = (seconds: number): number => (config.quantize ? Math.ceil(seconds * config.fps - 1e-6) / config.fps : Number(seconds.toFixed(6)));
  const elapsed = (): number => (performance.now() - startedAt) / 1000;
  const stamp = (): number => stampAt(elapsed());
  // The program asked where the cursor is: the next position report on stdin is the terminal's answer, not a key.
  let cursorQueried = false;
  const push = (type: CastEvent[1], data: string): void => {
    events.push([stamp(), type, data]);
  };

  const browser = config.browser ? startBrowserCapture({ ...config, cols, rows }, stamp, log) : null;
  const setup = opts.command ? { cmd: opts.command, env: {} } : shellSetup(config);
  const env = {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    ...setup.env,
    ...config.env,
  };

  let exited = false;
  let resolveExit!: () => void;
  const exitedPromise = new Promise<void>((r) => (resolveExit = r));

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
        if (text.includes(CURSOR_QUERY)) cursorQueried = true;
        stdout.write(chunk);
        push("o", text);
      },
      exit() {
        exited = true;
        resolveExit();
      },
    },
  });
  const terminal = proc.terminal;
  if (!terminal) throw new Error("Bun.spawn did not return a terminal. Is this Bun >= 1.4?");

  const isTTY = Boolean(stdin?.isTTY);
  const onData = (chunk: Buffer | string): void => {
    if (exited || terminal.closed) return;
    terminal.write(chunk);
    // Everything goes to the program, but only keystrokes are recorded: the terminal's answers to its queries
    // would otherwise show up as key chips and be typed back on replay.
    const text = chunk instanceof Uint8Array ? chunk.toString("utf8") : chunk;
    const keys = stripTerminalReplies(text, { cursorQueried });
    if (cursorQueried && hasCursorReport(text)) cursorQueried = false;
    if (keys) push("i", keys);
  };
  const onResize = (): void => {
    const c = process.stdout.columns ?? cols;
    const r = process.stdout.rows ?? rows;
    if (exited || terminal.closed) return;
    terminal.resize(c, r);
    push("r", `${c}x${r}`);
  };

  if (stdin) {
    if (isTTY) stdin.setRawMode?.(true);
    stdin.resume();
    stdin.on("data", onData);
  }
  process.on("SIGWINCH", onResize);
  log(`recording ${opts.describe ?? setup.cmd.join(" ")} at ${cols}×${rows} — ${opts.command ? "ends when the command exits" : "type exit to stop"}`);

  try {
    await Promise.race([exitedPromise, proc.exited]);
    // Hold the final screen for `endPause`, like a scripted recording does — otherwise a command that exits in
    // 20 ms (`tcut rec -- ls`) becomes a three-frame video. The timeline is virtual: stamp it, don't sleep.
    events.push([stampAt(elapsed() + config.endPause / 1000), "m", MARKER.end]);
  } finally {
    await browser?.stop();
    const emitter: NodeJS.EventEmitter = process; // @types/bun's process.off() lacks the signal overload; the generic emitter has it
    emitter.off("SIGWINCH", onResize);
    if (stdin) {
      stdin.off("data", onData);
      if (isTTY) stdin.setRawMode?.(false);
      stdin.pause();
    }
    try {
      terminal.close();
    } catch {
      /* already closed */
    }
    if (!exited) proc.kill();
    await proc.exited.catch(() => undefined);
  }

  const duration = events.length > 0 ? events[events.length - 1]![0] : 0;
  return {
    header: {
      version: 2,
      width: cols,
      height: rows,
      timestamp: Math.floor(Date.now() / 1000),
      duration,
      title: config.title || undefined,
      env: { TERM: "xterm-256color", SHELL: setup.cmd[0]! },
      bunVideo: { ...config, cols, rows },
    },
    events,
    ...(browser && { browserFrames: browser.frames }),
  };
}
