import type { KeyName } from "./types";

const ESC = "\x1b";

const keySequences = {
  enter: "\r",
  tab: "\t",
  backspace: "\x7f",
  delete: `${ESC}[3~`,
  escape: ESC,
  space: " ",
  up: `${ESC}[A`,
  down: `${ESC}[B`,
  right: `${ESC}[C`,
  left: `${ESC}[D`,
  home: `${ESC}[H`,
  end: `${ESC}[F`,
  pageUp: `${ESC}[5~`,
  pageDown: `${ESC}[6~`,
  insert: `${ESC}[2~`,
  f1: `${ESC}OP`,
  f2: `${ESC}OQ`,
  f3: `${ESC}OR`,
  f4: `${ESC}OS`,
  f5: `${ESC}[15~`,
  f6: `${ESC}[17~`,
  f7: `${ESC}[18~`,
  f8: `${ESC}[19~`,
  f9: `${ESC}[20~`,
  f10: `${ESC}[21~`,
  f11: `${ESC}[23~`,
  f12: `${ESC}[24~`,
} satisfies Record<KeyName, string>;

/** In application cursor mode (DECCKM, used by vim/less/fzf) cursor keys send SS3 instead of CSI. */
const appCursorSequences = new Map<string, string>([
  ["up", `${ESC}OA`],
  ["down", `${ESC}OB`],
  ["right", `${ESC}OC`],
  ["left", `${ESC}OD`],
  ["home", `${ESC}OH`],
  ["end", `${ESC}OF`],
]);

export interface KeySequenceOptions {
  /** The program switched on application cursor mode; arrows/home/end use the SS3 form. */
  appCursor?: boolean;
}

export function keySequence(name: KeyName, opts: KeySequenceOptions = {}): string {
  if (opts.appCursor) {
    const app = appCursorSequences.get(name);
    if (app) return app;
  }
  const seq = keySequences[name];
  if (seq === undefined) {
    throw new Error(`Unknown key "${name}". Known keys: ${Object.keys(keySequences).join(", ")}`);
  }
  return seq;
}

/** Ctrl+<letter> → control character (Ctrl+C = 0x03). Also accepts "[", "]", "\\", "^", "_", "@". */
export function ctrlSequence(key: string): string {
  if (key.length !== 1) throw new Error(`ctrl() expects a single character, got "${key}"`);
  const upper = key.toUpperCase();
  const code = upper.charCodeAt(0);
  if (code >= 0x40 && code <= 0x5f) return String.fromCharCode(code & 0x1f);
  if (key === "?") return "\x7f";
  if (key === " ") return "\x00";
  throw new Error(`Cannot send Ctrl+${key}`);
}

const shiftedNamed = new Map<string, string>([
  ["tab", `${ESC}[Z`],
  ["up", `${ESC}[1;2A`],
  ["down", `${ESC}[1;2B`],
  ["right", `${ESC}[1;2C`],
  ["left", `${ESC}[1;2D`],
  ["home", `${ESC}[1;2H`],
  ["end", `${ESC}[1;2F`],
  ["delete", `${ESC}[3;2~`],
  ["pageUp", `${ESC}[5;2~`],
  ["pageDown", `${ESC}[6;2~`],
  ["enter", "\r"],
  ["space", " "],
]);

/** Shift+<key>: back-tab, shifted navigation keys (xterm modifier 2), or an uppercased character. */
export function shiftSequence(key: string): string {
  const named = shiftedNamed.get(key);
  if (named) return named;
  if (key.length === 1) return key.toUpperCase();
  throw new Error(`Cannot send Shift+${key}. Known: ${[...shiftedNamed.keys()].join(", ")}, or a single character.`);
}

/** SGR mouse wheel event (button 64 = up, 65 = down) at a 1-based cell position. */
export function wheelSequence(direction: "up" | "down", col: number, row: number): string {
  return `${ESC}[<${direction === "up" ? 64 : 65};${col};${row}M`;
}

/** Alt/Meta+<key> → ESC-prefixed key. */
export function altSequence(key: string): string {
  const isNamed = key in keySequences;
  return ESC + (isNamed ? keySequence(key as KeyName) : key);
}
