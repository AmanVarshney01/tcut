import { WasmBridge, type TerminalCore } from "@wterm/core";
import { GhosttyCore } from "@wterm/ghostty";
import { ghosttyWasmUrl } from "./renderer/bundle";
import type { CoreName } from "./types";

let logsSilenced = false;

/** libghostty reports unimplemented modes via console.log (e.g. bash's `?1034h`); keep them out of CLI output. */
function silenceGhosttyLogs(): void {
  if (logsSilenced) return;
  logsSilenced = true;
  const original = console.log;
  console.log = (...args: unknown[]) => {
    if (args[0] === "[ghostty-vt]") return;
    original(...args);
  };
}

export interface ScreenOptions {
  /** Called with terminal responses (e.g. Device Attributes replies) that must be written back to the PTY. */
  onResponse?: (data: string) => void;
  core?: CoreName;
}

export async function loadCore(core: CoreName = "ghostty"): Promise<TerminalCore> {
  if (core === "lite") return WasmBridge.load();
  silenceGhosttyLogs();
  return GhosttyCore.load({ wasmPath: await ghosttyWasmUrl() });
}

/**
 * Headless terminal model backed by libghostty (WASM). The recorder feeds every PTY chunk through it so
 * `wait()` / `expect()` / `run()` look at the actual screen instead of a raw byte stream.
 */
/** Zero-based cursor cell. */
export interface CursorPosition {
  x: number;
  y: number;
}

/** Text of every scrollback line, oldest first (trailing blanks trimmed). Offset 0 is the most recent line. */
export function scrollbackLines(core: TerminalCore): string[] {
  const count = core.getScrollbackCount();
  const lines: string[] = [];
  for (let offset = count - 1; offset >= 0; offset--) {
    const len = core.getScrollbackLineLen(offset);
    let text = "";
    for (let col = 0; col < len; col++) {
      const cell = core.getScrollbackCell(offset, col);
      if (cell.width === 0) continue;
      text += cell.chars ?? (cell.char === 0 ? " " : String.fromCodePoint(cell.char));
    }
    lines.push(text.replace(/\s+$/, ""));
  }
  return lines;
}

export class Screen {
  private listeners = new Set<() => void>();
  onResponse: ((data: string) => void) | undefined;

  private constructor(readonly core: TerminalCore) {}

  static async create(cols: number, rows: number, opts: ScreenOptions = {}): Promise<Screen> {
    const core = await loadCore(opts.core);
    core.init(cols, rows);
    const screen = new Screen(core);
    screen.onResponse = opts.onResponse;
    return screen;
  }

  write(data: string | Uint8Array): void {
    if (data instanceof Uint8Array) this.core.writeRaw(data);
    else this.core.writeString(data);
    this.drainResponses();
    for (const listener of this.listeners) listener();
  }

  private drainResponses(): void {
    for (let i = 0; i < 64; i++) {
      const response = this.core.getResponse();
      if (response === null || response === undefined || response.length === 0) return;
      this.onResponse?.(response);
    }
  }

  /** Writes are synchronous; kept for API symmetry with async models. */
  async settle(): Promise<void> {}

  /** Resolves the next time a chunk is written. */
  nextFlush(): Promise<void> {
    return new Promise((resolve) => {
      const listener = () => {
        this.listeners.delete(listener);
        resolve();
      };
      this.listeners.add(listener);
    });
  }

  resize(cols: number, rows: number): void {
    this.core.resize(cols, rows);
  }

  get cols(): number {
    return this.core.getCols();
  }

  get rows(): number {
    return this.core.getRows();
  }

  cursor(): CursorPosition {
    const c = this.core.getCursor();
    return { x: c.col, y: c.row };
  }

  /** Absolute index of the cursor line, counting every line that ever scrolled off the top. */
  absoluteCursorLine(): number {
    const discarded = this.core.getScrollbackDiscardedCount?.() ?? 0;
    return discarded + this.core.getScrollbackCount() + this.core.getCursor().row;
  }

  rowText(row: number): string {
    let text = "";
    const cols = this.core.getCols();
    for (let col = 0; col < cols; col++) {
      const cell = this.core.getCell(row, col);
      if (cell.width === 0) continue; // wide-char continuation
      if (cell.chars) text += cell.chars;
      else text += cell.char === 0 ? " " : String.fromCodePoint(cell.char);
    }
    return text.replace(/\s+$/, "");
  }

  line(): string {
    return this.rowText(this.core.getCursor().row);
  }

  /**
   * The cursor line up to the cursor column. Prompt detection uses this rather than the whole line: after a
   * full-screen program exits, the primary screen may still hold stale text to the right of the cursor.
   */
  lineToCursor(): string {
    const { row, col } = this.core.getCursor();
    let text = "";
    for (let x = 0; x < col; x++) {
      const cell = this.core.getCell(row, x);
      if (cell.width === 0) continue;
      text += cell.chars ?? (cell.char === 0 ? " " : String.fromCodePoint(cell.char));
    }
    return text;
  }

  screen(): string {
    const rows: string[] = [];
    for (let y = 0; y < this.core.getRows(); y++) rows.push(this.rowText(y));
    return rows.join("\n");
  }

  usingAltScreen(): boolean {
    return this.core.usingAltScreen();
  }

  /** DECCKM: the program wants SS3 cursor keys (vim, less, fzf …). */
  cursorKeysApp(): boolean {
    return this.core.cursorKeysApp();
  }

  /** The program asked for bracketed paste (readline, zsh, vim, most TUIs). */
  bracketedPaste(): boolean {
    return this.core.bracketedPaste();
  }

  /** Inside a synchronized-output block (mode 2026): the screen is mid-update and should not be captured. */
  synchronizedOutput(): boolean {
    return this.core.synchronizedOutput?.() ?? false;
  }

  /** Lines that scrolled off the top, oldest first. */
  scrollback(): string[] {
    return scrollbackLines(this.core);
  }

  /** Everything the session has shown: scrollback followed by the visible screen. */
  transcript(): string {
    const screen = this.screen().split("\n");
    while (screen.length && screen[screen.length - 1] === "") screen.pop();
    return [...this.scrollback(), ...screen].join("\n");
  }

  /** 0 when the program has not enabled mouse tracking (so wheel events would be typed as garbage). */
  mouseTracking(): number {
    return this.core.mouseTracking?.() ?? 0;
  }

  dispose(): void {
    this.listeners.clear();
  }
}
