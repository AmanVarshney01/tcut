// Generates src/themes.generated.json from the Ghostty-format themes in mbadolato/iTerm2-Color-Schemes (MIT) —
// the same collection Ghostty bundles. Run: `bun scripts/build-themes.ts` (network). Output is committed.
import path from "node:path";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

const SOURCE = "https://github.com/mbadolato/iTerm2-Color-Schemes/archive/refs/heads/master.tar.gz";
const out = path.resolve(import.meta.dir, "..", "src", "themes.generated.json");

const KEYS = [
  "black", "red", "green", "yellow", "blue", "magenta", "cyan", "white",
  "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite",
] as const;

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const hex = (v: string) => {
  const h = v.trim().replace(/^#/, "");
  return /^[0-9a-f]{6}$/i.test(h) ? `#${h.toLowerCase()}` : null;
};

function parse(name: string, text: string): Record<string, string> | null {
  const palette: Record<number, string> = {};
  const props: Record<string, string> = {};
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    const value = line.slice(eq + 1).trim();
    if (key === "palette") {
      const m = /^(\d+)\s*=\s*(.+)$/.exec(value);
      if (m) {
        const c = hex(m[2]!);
        if (c) palette[Number(m[1])] = c;
      }
    } else {
      props[key] = value;
    }
  }
  const background = hex(props.background ?? "");
  const foreground = hex(props.foreground ?? "");
  if (!background || !foreground) return null;
  for (let i = 0; i < 16; i++) if (!palette[i]) return null;
  const theme: Record<string, string> = { name, background, foreground };
  const cursor = hex(props["cursor-color"] ?? "");
  if (cursor) theme.cursor = cursor;
  const cursorText = hex(props["cursor-text"] ?? "");
  if (cursorText) theme.cursorAccent = cursorText;
  const selection = hex(props["selection-background"] ?? "");
  if (selection) theme.selectionBackground = selection;
  KEYS.forEach((k, i) => (theme[k] = palette[i]!));
  return theme;
}

const tmp = await mkdtemp(path.join(tmpdir(), "tcut-themes-"));
const tgz = path.join(tmp, "schemes.tgz");
const res = await fetch(SOURCE);
if (!res.ok) throw new Error(`download failed: ${res.status}`);
await Bun.write(tgz, await res.arrayBuffer());
const untar = Bun.spawn(["tar", "-xzf", tgz, "-C", tmp], { stdout: "ignore", stderr: "pipe" });
if ((await untar.exited) !== 0) throw new Error(await new Response(untar.stderr).text());
const root = (await readdir(tmp)).find((d) => d.startsWith("iTerm2-Color-Schemes"));
if (!root) throw new Error("unexpected archive layout");
const dir = path.join(tmp, root, "ghostty");

const themes: Record<string, Record<string, string>> = {};
let skipped = 0;
for (const file of (await readdir(dir)).sort()) {
  const text = await Bun.file(path.join(dir, file)).text();
  const theme = parse(file, text);
  if (!theme) {
    skipped++;
    continue;
  }
  themes[slug(file)] = theme;
}
await rm(tmp, { recursive: true, force: true });

await Bun.write(out, JSON.stringify(themes) + "\n");
console.log(`wrote ${path.relative(process.cwd(), out)}: ${Object.keys(themes).length} themes (${skipped} skipped), ${(Bun.file(out).size / 1024).toFixed(0)} KB`);
