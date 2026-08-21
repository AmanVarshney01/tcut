import { tokenize } from "./scriptgen";

const NAMED = new Map<string, string>([
  ["\r", "⏎"],
  ["\n", "⏎"],
  ["\t", "⇥"],
  ["\x1b[Z", "⇧⇥"],
  ["\x7f", "⌫"],
  ["\x1b", "esc"],
  ["\x1b[A", "↑"],
  ["\x1b[B", "↓"],
  ["\x1b[C", "→"],
  ["\x1b[D", "←"],
  ["\x1bOA", "↑"],
  ["\x1bOB", "↓"],
  ["\x1bOC", "→"],
  ["\x1bOD", "←"],
  ["\x1b[1;2A", "⇧↑"],
  ["\x1b[1;2B", "⇧↓"],
  ["\x1b[1;2C", "⇧→"],
  ["\x1b[1;2D", "⇧←"],
  ["\x1b[H", "home"],
  ["\x1b[F", "end"],
  ["\x1b[3~", "del"],
  ["\x1b[5~", "pgup"],
  ["\x1b[6~", "pgdn"],
]);

/** Human-readable labels for a raw input chunk: printable runs stay words, control sequences become symbols. */
export function keyLabels(input: string): string[] {
  const labels: string[] = [];
  for (const token of tokenize(input)) {
    if (token === " ") { labels.push(" "); continue; }
    const named = NAMED.get(token);
    if (named) {
      labels.push(named);
    } else if (token.length === 1 && token.charCodeAt(0) < 32) {
      labels.push(`⌃${String.fromCharCode(token.charCodeAt(0) + 64)}`);
    } else if (token.length === 2 && token[0] === "\x1b") {
      labels.push(`⌥${token[1]}`);
    } else if (token.startsWith("\x1b[<")) {
      const wheel = token.endsWith("M") && (token.startsWith("\x1b[<64") || token.startsWith("\x1b[<65"));
      labels.push(wheel ? "wheel" : "mouse");
    } else if (token.startsWith("\x1b")) {
      labels.push("esc…");
    } else {
      labels.push(token);
    }
  }
  return labels;
}

export interface KeyChip {
  /** Time the chip appeared (visible timeline, seconds). */
  at: number;
  label: string;
}

/**
 * Turn timed input events into chips. Printable keystrokes within `mergeWithin` seconds of each other are merged
 * into one chip (so typing reads as words, not a flood of letters); named keys always get their own chip.
 */
export interface ChipBuilder {
  chips: KeyChip[];
  push(vt: number, data: string): void;
}

/** Incremental version of keyChips: feed events as the clock passes them and a word chip grows while it is typed. */
export function chipBuilder(mergeWithin = 0.35): ChipBuilder {
  const chips: KeyChip[] = [];
  let lastPrintable: KeyChip | null = null;
  let lastTime = -Infinity;
  return {
    chips,
    push(vt, data) {
      for (const label of keyLabels(data)) {
        const printable = !/^[⏎⇥⌫␣↑↓→←⌃⌥⇧]|^(esc|home|end|del|pgup|pgdn|wheel|mouse)/.test(label);
        if (printable && lastPrintable && vt - lastTime <= mergeWithin) {
          lastPrintable.label += label;
          lastPrintable.at = vt;
        } else {
          const chip = { at: vt, label };
          chips.push(chip);
          lastPrintable = printable ? chip : null;
        }
        lastTime = vt;
      }
    },
  };
}

export function keyChips(inputs: Array<{ vt: number; data: string }>, mergeWithin = 0.35): KeyChip[] {
  const builder = chipBuilder(mergeWithin);
  for (const { vt, data } of inputs) builder.push(vt, data);
  return builder.chips;
}
