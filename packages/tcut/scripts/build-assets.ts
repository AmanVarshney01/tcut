// Builds the browser bundles and copies static assets into src/renderer/generated/ so that
// `bun build --compile` can embed them. Run via `bun run build:assets`.
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const rendererDir = path.join(root, "src", "renderer");
const outDir = path.join(rendererDir, "generated");

function packageRoot(specifier: string): string {
  const entry = Bun.resolveSync(specifier, root);
  let dir = path.dirname(entry);
  for (let i = 0; i < 5; i++) {
    if (path.basename(path.dirname(dir)) === "@wterm") return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`Could not locate package root for ${specifier}`);
}

await mkdir(outDir, { recursive: true });

for (const [entry, out] of [
  ["page-entry.ts", "page.js"],
  ["player-entry.ts", "player.js"],
] as const) {
  const result = await Bun.build({
    entrypoints: [path.join(rendererDir, entry)],
    target: "browser",
    format: "esm",
    minify: true,
  });
  if (!result.success) {
    console.error(result.logs.map((l) => l.message).join("\n"));
    process.exit(1);
  }
  await Bun.write(path.join(outDir, out), await result.outputs[0]!.text());
}

await Bun.write(path.join(outDir, "terminal.css"), Bun.file(path.join(packageRoot("@wterm/dom"), "src", "terminal.css")));
await Bun.write(path.join(outDir, "ghostty-vt.wasm"), Bun.file(path.join(packageRoot("@wterm/ghostty"), "wasm", "ghostty-vt.wasm")));

const sizes = await Promise.all(
  ["page.js", "player.js", "terminal.css", "ghostty-vt.wasm"].map(async (f) => `${f} ${(Bun.file(path.join(outDir, f)).size / 1024).toFixed(0)} KB`),
);
console.log(`built src/renderer/generated/: ${sizes.join(", ")}`);
