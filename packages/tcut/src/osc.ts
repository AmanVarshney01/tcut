// Small helpers for OSC sequences tcut reads or writes itself, independent of the emulator core.
// Patterns never contain control characters: ESC and BEL are mapped to private-use code points first.
const ESC = "\x1b";
const BEL = "\x07";
const ESC_MARK = "\uE000";
const BEL_MARK = "\uE001";

const marked = (chunk: string): string => chunk.replaceAll(ESC, ESC_MARK).replaceAll(BEL, BEL_MARK);

/** Every window title set in `chunk` via OSC 0/2 (`ESC ] 0 ; title BEL`), in order. */
export function extractTitles(chunk: string): string[] {
  return [...marked(chunk).matchAll(/\uE000\](?:0|2);([^\uE000\uE001]*)(?:\uE001|\uE000\\)/g)].map((m) => m[1] ?? "");
}

/** The last window title set in `chunk`, or null — what a live window bar should show after the chunk. */
export function extractTitle(chunk: string): string | null {
  const titles = extractTitles(chunk);
  return titles.length ? titles[titles.length - 1]! : null;
}

/** Wrap `text` in an OSC 8 hyperlink (terminals, the HTML player and the SVG export make it clickable). */
export function hyperlink(text: string, url: string): string {
  return `${ESC}]8;;${url}${ESC}\\${text}${ESC}]8;;${ESC}\\`;
}

/** Markdown `[text](url)` → underlined text carrying an OSC 8 link, so captions get real links instead of a printed URL. */
export function linkifyMarkdown(markdown: string): string {
  return markdown.replace(/\[([^\]\n]+)\]\((https?:\/\/[^)\s]+)\)/g, (_, text: string, url: string) => hyperlink(`${ESC}[4m${text}${ESC}[24m`, url));
}

export interface UnsupportedProtocol {
  name: string;
  count: number;
  note: string;
}

export interface GraphicsProtocol {
  name: string;
  count: number;
  supported: boolean;
  note: string;
}

const KITTY_GRAPHICS_PATTERN = /\uE000_G/g;

const ALWAYS_UNSUPPORTED: Array<{ name: string; pattern: RegExp; note: string }> = [
  { name: "sixel", pattern: /\uE000P[0-9;]*q/g, note: "Sixel images are not rendered" },
  { name: "iterm2-image", pattern: /\uE000\]1337;File=/g, note: "iTerm2 inline images are not rendered" },
  { name: "tmux-passthrough", pattern: /\uE000Ptmux;/g, note: "tmux passthrough sequences are ignored" },
];

/** Count Kitty graphics APCs in output. */
export function countKittyGraphics(output: string): number {
  const safe = marked(output);
  return (safe.match(KITTY_GRAPHICS_PATTERN) ?? []).length;
}

/**
 * Detect graphics protocols in output.
 * @param core - The emulator core: "ghostty" supports Kitty graphics, "lite" does not.
 */
export function detectGraphicsProtocols(output: string, core: "ghostty" | "lite" = "ghostty"): GraphicsProtocol[] {
  const safe = marked(output);
  const result: GraphicsProtocol[] = [];

  const kittyCount = (safe.match(KITTY_GRAPHICS_PATTERN) ?? []).length;
  if (kittyCount > 0) {
    const supported = core === "ghostty";
    result.push({
      name: "kitty-graphics",
      count: kittyCount,
      supported,
      note: supported
        ? "Kitty graphics protocol: inline images are rendered with the Ghostty core"
        : "Kitty graphics protocol: inline images require the Ghostty core (use core: \"ghostty\")",
    });
  }

  for (const proto of ALWAYS_UNSUPPORTED) {
    const count = (safe.match(proto.pattern) ?? []).length;
    if (count > 0) {
      result.push({ name: proto.name, count, supported: false, note: proto.note });
    }
  }

  return result;
}

/** Image/graphics protocols tcut cannot draw, counted across a chunk of output. */
export function unsupportedProtocols(output: string, core: "ghostty" | "lite" = "ghostty"): UnsupportedProtocol[] {
  return detectGraphicsProtocols(output, core)
    .filter((p) => !p.supported)
    .map(({ name, count, note }) => ({ name, count, note }));
}
