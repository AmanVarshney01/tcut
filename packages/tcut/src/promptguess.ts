import { loadCore } from "./screen";
import type { Recording } from "./types";

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Prompts end in a symbol: what a generated script waits for when the user's own shell is recorded. */
export const USER_PROMPT_PATTERN = "[❯>$%#»➜λ]\\s*$";

/**
 * What the user's prompt ends with, read from the recording: the text up to the cursor just before the first
 * keystroke is the prompt; its final symbol (`❯`, `$`, `%`, …) is what `run()` should wait for. Replaying through
 * the headless core handles right-hand prompts and cursor movement that a plain text scan would misread.
 */
export async function detectPromptPattern(rec: Recording, core: "ghostty" | "lite" = "ghostty"): Promise<string | null> {
  const firstInput = rec.events.findIndex((e) => e[1] === "i");
  const before = (firstInput < 0 ? rec.events : rec.events.slice(0, firstInput)).filter((e) => e[1] === "o");
  if (before.length === 0) return null;
  const term = await loadCore(core);
  term.init(rec.header.width, rec.header.height);
  for (const e of before) term.writeString(e[2]);
  const { row, col } = term.getCursor();
  let line = "";
  for (let x = 0; x < col; x++) {
    const cell = term.getCell(row, x);
    if (cell.width === 0) continue;
    line += cell.chars ?? (cell.char === 0 ? " " : String.fromCodePoint(cell.char));
  }
  const trimmed = line.trimEnd();
  if (!trimmed) return null;
  const ender = [...trimmed].at(-1)!;
  // A letter or digit is not a prompt symbol (a bare path, say); fall back to the generic pattern.
  if (/[\p{L}\p{N}]/u.test(ender)) return null;
  return `${escapeRegExp(ender)}\\s*$`;
}
