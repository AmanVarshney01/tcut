// Cross-compile standalone binaries for every supported platform into dist/ and write SHA-256 checksums.
// Run `bun run build:assets` first (done by `bun run build:all`).
import { mkdir } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dir, "..");
const dist = path.join(root, "dist");
const version = (await Bun.file(path.join(root, "package.json")).json()).version as string;

const targets = [
  "bun-darwin-arm64",
  "bun-darwin-x64",
  "bun-linux-x64",
  "bun-linux-arm64",
  "bun-windows-x64",
] as const;

await mkdir(dist, { recursive: true });
const checksums: string[] = [];

for (const target of targets) {
  const platform = target.replace(/^bun-/, "");
  const ext = target.includes("windows") ? ".exe" : "";
  const outfile = path.join(dist, `tcut-${version}-${platform}${ext}`);
  const proc = Bun.spawn(
    ["bun", "build", "--compile", "--bytecode", "--minify", `--target=${target}`, path.join(root, "src", "cli.ts"), "--outfile", outfile],
    { cwd: root, stdout: "ignore", stderr: "pipe" },
  );
  const code = await proc.exited;
  if (code !== 0) {
    console.error(await new Response(proc.stderr).text());
    process.exit(code);
  }
  const bytes = await Bun.file(outfile).arrayBuffer();
  const hash = new Bun.CryptoHasher("sha256").update(bytes).digest("hex");
  checksums.push(`${hash}  ${path.basename(outfile)}`);
  console.log(`${path.basename(outfile)}  ${(bytes.byteLength / 1024 / 1024).toFixed(1)} MB`);
}

await Bun.write(path.join(dist, "SHA256SUMS"), checksums.join("\n") + "\n");
console.log("wrote dist/SHA256SUMS");
