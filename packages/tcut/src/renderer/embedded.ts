// Prebuilt assets produced by `bun run build:assets` (scripts/build-assets.ts). Imported with `type: "file"` so
// `bun build --compile` embeds them into the binary. In development this module fails to resolve until the assets
// are built, and bundle.ts falls back to building them at runtime.
import pageJs from "./generated/page.js" with { type: "file" };
import playerJs from "./generated/player.js" with { type: "file" };
import css from "./generated/terminal.css" with { type: "file" };
import wasm from "./generated/ghostty-vt.wasm" with { type: "file" };
import symbols from "./fonts/SymbolsNerdFontMono-Regular.ttf" with { type: "file" };
import type { PageAssets } from "./bundle";

export async function load(): Promise<PageAssets> {
  return {
    js: await Bun.file(pageJs).text(),
    playerJs: await Bun.file(playerJs).text(),
    css: await Bun.file(css).text(),
    wasmPath: wasm,
    symbolsFontPath: symbols,
  };
}
