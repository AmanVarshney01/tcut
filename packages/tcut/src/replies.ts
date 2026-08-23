// Answers a terminal sends to a program's queries — device attributes, kitty keyboard flags, colours via OSC,
// XTGETTCAP via DCS, cursor position reports. In a live recording they arrive on stdin together with the
// user's keystrokes, but they are not keystrokes: the key overlay must not show them and a replay must not
// type them (tcut answers the queries itself then).

const ESC = String.fromCharCode(0x1b);
const BEL = String.fromCharCode(0x07);

const REPLIES = new RegExp(
  [
    `${ESC}\\[\\?[\\d;]*[cu]`, // primary DA, kitty keyboard flags
    `${ESC}\\[>[\\d;]*c`, // secondary DA
    `${ESC}\\][\\d;]*[^${BEL}${ESC}]*(?:${BEL}|${ESC}\\\\)`, // OSC (colour queries)
    `${ESC}P[^${ESC}]*${ESC}\\\\`, // DCS (XTGETTCAP)
  ].join("|"),
  "g",
);

/** Cursor position report `ESC [ row ; col R` — the same bytes as a modified F3 key (`ESC [ 1 ; 2-8 R`). */
const CPR = new RegExp(`${ESC}\\[\\d+;\\d+R`, "g");
/** A CPR whose parameters cannot be a modifier-encoded F3: row other than 1, or a "modifier" outside 2–8. */
const UNAMBIGUOUS_CPR = new RegExp(`${ESC}\\[(?!1;[2-8]R)\\d+;\\d+R`, "g");

/** The program asked for the cursor position; the next CPR-shaped input is an answer, not a key. */
export const CURSOR_QUERY = `${ESC}[6n`;

export interface StripOptions {
  /** The program asked `ESC[6n`, so any CPR in this chunk is a reply; without it, only unambiguous reports are removed. */
  cursorQueried?: boolean;
}

export function stripTerminalReplies(input: string, opts: StripOptions = {}): string {
  return input.replace(REPLIES, "").replace(opts.cursorQueried ? CPR : UNAMBIGUOUS_CPR, "");
}

/** Does this input chunk carry a cursor position report (or the look-alike modified F3)? */
export const hasCursorReport = (input: string): boolean => new RegExp(CPR.source).test(input);
