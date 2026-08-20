import { MARKER } from "./cast";
import { shellSetup } from "./recorder";
import type { CastEvent, Recording, ResolvedConfig } from "./types";

export interface LiveOptions {
  /** Run this command instead of the configured clean shell. */
  command?: string[];
  /** Terminal size; defaults to the size of the terminal tcut is running in, then the config. */
  cols?: number;
  rows?: number;
  /** Where to mirror the session (default: this process's stdout). */
  stdout?: { write(data: Uint8Array | string): unknown };
  /** Keystroke source (default: this process's stdin, switched to raw mode when it is a TTY). */
  stdin?: NodeJS.ReadStream | null;
  log?: (message: string) => void;
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

  const stamp = (): number => {
    const t = (performance.now() - startedAt) / 1000;
    return config.quantize ? Math.ceil(t * config.fps - 1e-6) / config.fps : Number(t.toFixed(6));
  };
  const push = (type: CastEvent[1], data: string): void => {
    events.push([stamp(), type, data]);
  };

  const setup = opts.command ? { cmd: opts.command, env: {} } : shellSetup(config);
  const env: Record<string, string> = {
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

  const isTTY = Boolean(stdin && (stdin as NodeJS.ReadStream).isTTY);
  const onData = (chunk: Buffer | string): void => {
    if (exited || terminal.closed) return;
    terminal.write(chunk);
    push("i", typeof chunk === "string" ? chunk : chunk.toString("utf8"));
  };
  const onResize = (): void => {
    const c = process.stdout.columns ?? cols;
    const r = process.stdout.rows ?? rows;
    if (exited || terminal.closed) return;
    terminal.resize(c, r);
    push("r", `${c}x${r}`);
  };

  if (stdin) {
    if (isTTY) stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  }
  process.on("SIGWINCH", onResize);
  log(`recording ${setup.cmd.join(" ")} at ${cols}x${rows} — exit the shell to stop`);

  try {
    await Promise.race([exitedPromise, proc.exited]);
    push("m", MARKER.end);
  } finally {
    process.off("SIGWINCH", onResize);
    if (stdin) {
      stdin.off("data", onData);
      if (isTTY) stdin.setRawMode(false);
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
  };
}
