// After the client build (with a manifest) and the SSR build: render "/" to a complete document and write it
// as dist/index.html, referencing the hashed client bundle and stylesheet.
import path from "node:path";

const web = path.resolve(import.meta.dir, "..");
const dist = process.env.DIST ? path.resolve(process.env.DIST) : path.join(web, "dist");

interface ManifestChunk {
  file: string;
  css?: string[];
  isEntry?: boolean;
}

const manifest = (await Bun.file(path.join(dist, ".vite", "manifest.json")).json()) as Record<string, ManifestChunk>;
const entry = manifest["src/entry-client.tsx"];
if (!entry) throw new Error("manifest has no src/entry-client.tsx entry");
const assets = { scripts: [`/${entry.file}`], styles: (entry.css ?? []).map((f) => `/${f}`) };

const server = await import(path.join(web, "dist-ssr", "entry-server.js"));
const html: string = await server.render("https://tcut.amanv.dev/", assets);
await Bun.write(path.join(dist, "index.html"), html);
console.log(`prerendered / (${(html.length / 1024).toFixed(0)} KB) with ${assets.scripts.join(", ")} and ${assets.styles.join(", ")}`);
