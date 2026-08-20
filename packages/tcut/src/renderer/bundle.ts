import path from "node:path";

export interface PageAssets {
  /** Renderer page bundle (ESM). */
  js: string;
  /** Self-contained player bundle (ESM, lite core with inline WASM). */
  playerJs: string;
  css: string;
  wasmPath: string;
}

let cached: Promise<PageAssets> | null = null;

function packageRoot(specifier: string): string {
  const entry = Bun.resolveSync(specifier, import.meta.dir);
  let dir = path.dirname(entry);
  for (let i = 0; i < 5; i++) {
    if (path.basename(path.dirname(dir)) === "@wterm") return dir;
    dir = path.dirname(dir);
  }
  throw new Error(`Could not locate package root for ${specifier} (resolved to ${entry})`);
}

async function bundle(entry: string): Promise<string> {
  const result = await Bun.build({
    entrypoints: [path.join(import.meta.dir, entry)],
    target: "browser",
    format: "esm",
    minify: true,
  });
  if (!result.success) {
    throw new Error(`Failed to bundle ${entry}:\n${result.logs.map((l) => l.message).join("\n")}`);
  }
  return result.outputs[0]!.text();
}

async function embeddedAssets(): Promise<PageAssets | null> {
  try {
    const embedded = await import("./embedded");
    return await embedded.load();
  } catch {
    return null;
  }
}

/** True inside a `bun build --compile` binary, where sources live on the virtual /$bunfs filesystem. */
const isCompiled = import.meta.dir.startsWith("/$bunfs");

/**
 * Prebuilt assets in the compiled binary; otherwise built at runtime with Bun.build so edits to the page entries
 * take effect immediately (prebuilt files in src/renderer/generated/ could be stale during development).
 */
async function loadAssets(): Promise<PageAssets> {
  const embedded = isCompiled ? await embeddedAssets() : null;
  if (embedded) return embedded;
  const [js, playerJs] = await Promise.all([bundle("page-entry.ts"), bundle("player-entry.ts")]);
  return {
    js,
    playerJs,
    css: await Bun.file(path.join(packageRoot("@wterm/dom"), "src", "terminal.css")).text(),
    wasmPath: path.join(packageRoot("@wterm/ghostty"), "wasm", "ghostty-vt.wasm"),
  };
}

export function pageAssets(): Promise<PageAssets> {
  cached ??= loadAssets();
  return cached;
}

let wasmUrl: Promise<string> | null = null;

/**
 * Ghostty's loader fetches its WASM by URL and, in a compiled binary, would resolve it relative to a virtual
 * module path. Hand it a data: URL built from the embedded (or node_modules) binary instead.
 */
export function ghosttyWasmUrl(): Promise<string> {
  wasmUrl ??= (async () => {
    const embedded = await embeddedAssets();
    const file = embedded?.wasmPath ?? path.join(packageRoot("@wterm/ghostty"), "wasm", "ghostty-vt.wasm");
    const bytes = await Bun.file(file).arrayBuffer();
    return `data:application/wasm;base64,${Buffer.from(bytes).toString("base64")}`;
  })();
  return wasmUrl;
}
