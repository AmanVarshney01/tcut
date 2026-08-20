import type { KeyName } from "./types";

const ESC = "\x1b";

const keySequences: Record<KeyName, string> = {
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
};

export function keySequence(name: KeyName): string {
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

/** Alt/Meta+<key> → ESC-prefixed key. */
export function altSequence(key: string): string {
  const isNamed = key in keySequences;
  return ESC + (isNamed ? keySequence(key as KeyName) : key);
}
