// Small helpers for OSC sequences tcut reads or writes itself, independent of the emulator core.
// Patterns never contain control characters: ESC and BEL are mapped to private-use code points first.
const ESC = "\x1b";
const BEL = "\x07";
const ESC_MARK = "";
const BEL_MARK = "";

const marked = (chunk: string): string => chunk.replaceAll(ESC, ESC_MARK).replaceAll(BEL, BEL_MARK);

/** Every window title set in `chunk` via OSC 0/2 (`ESC ] 0 ; title BEL`), in order. */
export function extractTitles(chunk: string): string[] {
  return [...marked(chunk).matchAll(/\](?:0|2);([^]*)(?:|\\)/g)].map((m) => m[1] ?? "");
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

const PROTOCOLS: Array<{ name: string; pattern: RegExp; note: string }> = [
  { name: "kitty-graphics", pattern: /_G/g, note: "Kitty graphics protocol (inline images) is not rendered" },
  { name: "sixel", pattern: /P[0-9;]*q/g, note: "Sixel images are not rendered" },
  { name: "iterm2-image", pattern: /\]1337;File=/g, note: "iTerm2 inline images are not rendered" },
  { name: "tmux-passthrough", pattern: /Ptmux;/g, note: "tmux passthrough sequences are ignored" },
];

/** Image/graphics protocols tcut cannot draw, counted across a chunk of output. */
export function unsupportedProtocols(output: string): UnsupportedProtocol[] {
  const safe = marked(output);
  return PROTOCOLS.map((p) => ({ name: p.name, count: (safe.match(p.pattern) ?? []).length, note: p.note })).filter((p) => p.count > 0);
}
