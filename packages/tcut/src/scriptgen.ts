import path from "node:path";
import type { Recording } from "./types";

export interface ScriptGenOptions {
  /** Output paths to put in the generated config. */
  output: string[];
  /** True when the recording drove the clean shell (so "text + Enter" can become `run()`). */
  cleanShell: boolean;
  /** The command that was recorded in `-- command` mode (becomes `shell: [...]`). */
  command?: string[];
  /** Gaps between keystrokes longer than this become `sleep()` calls. Default 400 ms. */
  pauseThresholdMs?: number;
  /** Where the cast lives, for the header comment. */
  castPath?: string;
}

type Op =
  | { kind: "type"; text: string }
  | { kind: "run"; command: string }
  | { kind: "key"; name: string; times: number }
  | { kind: "ctrl"; letter: string; times: number }
  | { kind: "alt"; key: string; times: number }
  | { kind: "raw"; data: string }
  | { kind: "sleep"; ms: number };

const NAMED = new Map<string, string>([
  ["\r", "enter"],
  ["\n", "enter"],
  ["\t", "tab"],
  ["\x7f", "backspace"],
  ["\x1b", "escape"],
  ["\x1b[A", "up"],
  ["\x1b[B", "down"],
  ["\x1b[C", "right"],
  ["\x1b[D", "left"],
  ["\x1bOA", "up"],
  ["\x1bOB", "down"],
  ["\x1bOC", "right"],
  ["\x1bOD", "left"],
  ["\x1b[H", "home"],
  ["\x1b[F", "end"],
  ["\x1b[1~", "home"],
  ["\x1b[4~", "end"],
  ["\x1b[3~", "delete"],
  ["\x1b[5~", "pageUp"],
  ["\x1b[6~", "pageDown"],
]);

/** Split a raw input chunk into individual key tokens (escape sequences, control chars, printable runs). */
export function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i]!;
    if (ch === "\x1b") {
      // CSI: ESC [ params final  |  SS3: ESC O x  |  Alt+key: ESC x  (matched after the ESC we already hold)
      const rest = input.slice(i + 1);
      const csi = /^\[[0-9;?]*[A-Za-z~]/.exec(rest);
      const ss3 = /^O[A-Za-z]/.exec(rest);
      if (csi) {
        tokens.push(ch + csi[0]);
        i += csi[0].length + 1;
      } else if (ss3) {
        tokens.push(ch + ss3[0]);
        i += ss3[0].length + 1;
      } else if (i + 1 < input.length) {
        tokens.push(input.slice(i, i + 2));
        i += 2;
      } else {
        tokens.push(ch);
        i += 1;
      }
      continue;
    }
    if (ch < " " || ch === "\x7f") {
      tokens.push(ch);
      i += 1;
      continue;
    }
    let j = i;
    while (j < input.length && input[j]! >= " " && input[j] !== "\x7f") j++;
    tokens.push(input.slice(i, j));
    i = j;
  }
  return tokens;
}

function roundMs(ms: number): number {
  if (ms < 1000) return Math.round(ms / 100) * 100;
  return Math.round(ms / 250) * 250;
}

function formatMs(ms: number): string {
  return ms % 1000 === 0 ? `"${ms / 1000}s"` : ms >= 1000 ? `"${(ms / 1000).toFixed(2).replace(/0+$/, "")}s"` : `"${ms}ms"`;
}

const q = (s: string) => JSON.stringify(s);

/** Turn the `i` (input) events of a recording into a list of script operations. */
export function eventsToOps(rec: Recording, opts: ScriptGenOptions): Op[] {
  const threshold = opts.pauseThresholdMs ?? 400;
  const ops: Op[] = [];
  let pendingText = "";
  let lastTime: number | null = null;

  const flushText = () => {
    if (pendingText) ops.push({ kind: "type", text: pendingText });
    pendingText = "";
  };
  const pushKey = (op: Op) => {
    const last = ops[ops.length - 1];
    if (last && last.kind === op.kind && op.kind !== "type" && op.kind !== "sleep" && op.kind !== "raw" && op.kind !== "run") {
      const a = last as { name?: string; letter?: string; key?: string; times: number };
      const b = op as { name?: string; letter?: string; key?: string; times: number };
      if (a.name === b.name && a.letter === b.letter && a.key === b.key) {
        a.times += b.times;
        return;
      }
    }
    ops.push(op);
  };

  for (const [time, type, data] of rec.events) {
    if (type !== "i") continue;
    if (lastTime !== null) {
      const gap = (time - lastTime) * 1000;
      if (gap > threshold) {
        flushText();
        ops.push({ kind: "sleep", ms: roundMs(gap) });
      }
    }
    lastTime = time;

    for (const token of tokenize(data)) {
      if (token.length > 1 && token[0]! >= " ") {
        pendingText += token;
        continue;
      }
      if (token.length === 1 && token >= " " && token !== "\x7f") {
        pendingText += token;
        continue;
      }
      const named = NAMED.get(token);
      if (named === "enter") {
        if (opts.cleanShell && pendingText.trim()) {
          const command = pendingText;
          pendingText = "";
          ops.push({ kind: "run", command });
        } else {
          flushText();
          pushKey({ kind: "key", name: "enter", times: 1 });
        }
        continue;
      }
      flushText();
      if (named) {
        pushKey({ kind: "key", name: named, times: 1 });
      } else if (token.length === 1 && token.charCodeAt(0) < 32) {
        const letter = String.fromCharCode(token.charCodeAt(0) + 96);
        pushKey({ kind: "ctrl", letter, times: 1 });
      } else if (token.length === 2 && token[0] === "\x1b") {
        pushKey({ kind: "alt", key: token[1]!, times: 1 });
      } else {
        ops.push({ kind: "raw", data: token });
      }
    }
  }
  flushText();

  // Drop a trailing `run("exit")` from clean-shell sessions: the recorder ends the shell itself.
  const last = ops[ops.length - 1];
  if (opts.cleanShell && last?.kind === "run" && /^\s*exit\s*$/.test(last.command)) ops.pop();
  while (ops.length && ops[ops.length - 1]!.kind === "sleep") ops.pop();
  return ops;
}

function opToLine(op: Op): string {
  switch (op.kind) {
    case "type":
      return `await t.type(${q(op.text)});`;
    case "run":
      return `await t.run(${q(op.command)});`;
    case "key":
      return op.times > 1 ? `await t.${op.name}(${op.times});` : `await t.${op.name}();`;
    case "ctrl":
      return op.times > 1 ? `await t.ctrl(${q(op.letter)}, ${op.times});` : `await t.ctrl(${q(op.letter)});`;
    case "alt":
      return op.times > 1 ? `await t.alt(${q(op.key)}, ${op.times});` : `await t.alt(${q(op.key)});`;
    case "raw":
      return `await t.raw(${q(op.data)});`;
    case "sleep":
      return `await t.sleep(${formatMs(op.ms)});`;
  }
}

/** Generate an editable TypeScript script that replays the input side of a recording. */
export function generateScript(rec: Recording, opts: ScriptGenOptions): string {
  const ops = eventsToOps(rec, opts);
  const cfg = rec.header.bunVideo;
  const config: string[] = [`output: ${JSON.stringify(opts.output)}`];
  if (opts.command) config.push(`shell: ${JSON.stringify(opts.command)}`);
  else if (cfg && cfg.shell !== "bash") config.push(`shell: ${JSON.stringify(cfg.shell)}`);
  config.push(`cols: ${rec.header.width}`, `rows: ${rec.header.height}`);
  if (cfg) {
    if (cfg.theme?.name) config.push(`theme: ${q(cfg.theme.name)}`);
    if (cfg.fps !== 60) config.push(`fps: ${cfg.fps}`);
    if (cfg.windowBar !== "none") config.push(`windowBar: ${q(cfg.windowBar)}`);
    if (cfg.title) config.push(`title: ${q(cfg.title)}`);
  }

  const body = ops.length ? ops.map((op) => `    ${opToLine(op)}`).join("\n") : "    // (no input was recorded)";
  const castNote = opts.castPath ? ` The exact recording is in ${path.basename(opts.castPath)}.` : "";
  const modeNote = opts.command
    ? "It runs the same command and replays your keys; waits are the pauses you took, so adjust them if the program is slower elsewhere."
    : "Typed commands became run(), which waits for the prompt instead of guessing.";

  return `import { defineVideo } from "tcut";

// Generated by \`tcut rec\` from what you typed — edit freely, then re-run with \`tcut <this file>\`.
// ${modeNote}${castNote}
export default defineVideo(
  {
${config.map((c) => `    ${c},`).join("\n")}
  },
  async (t) => {
${body}
    await t.sleep("1s");
  },
);
`;
}
