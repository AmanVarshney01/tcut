import { mkdir, mkdtemp, rename, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const generated = path.resolve(import.meta.dir, "../renderer/generated");
const app = path.resolve(import.meta.dir, "../../../../apps/presenter");

/** Vite's production output is shared by source runs, npm packages and compiled binaries. */
export async function buildPresenter(): Promise<void> {
  const output = await mkdtemp(path.join(tmpdir(), "tcut-presenter-"));
  try {
    const proc = Bun.spawn([process.execPath, "run", "build", "--outDir", output], {
      cwd: app, stdout: "pipe", stderr: "pipe",
    });
    const [code, stdout, stderr] = await Promise.all([
      proc.exited, new Response(proc.stdout).text(), new Response(proc.stderr).text(),
    ]);
    if (code !== 0) throw new Error(`Presenter build failed:\n${stdout}\n${stderr}`);
    await mkdir(generated, { recursive: true });
    for (const file of ["presenter.js", "presenter.css"]) {
      const target = path.join(generated, file);
      const temporary = `${target}.${crypto.randomUUID()}.tmp`;
      try {
        await Bun.write(temporary, Bun.file(path.join(output, file)));
        await rename(temporary, target);
      } finally { await rm(temporary, { force: true }); }
    }
  } finally { await rm(output, { recursive: true, force: true }); }
}

let cached: Promise<{ js: string; css: string }> | undefined;
export function presenterAssets(): Promise<{ js: string; css: string }> {
  return (cached ??= (async () => {
    if (Bun.isStandaloneExecutable)
      return (await import("./embedded")).loadPresenter();
    // Rebuild only when serving the presenter in a source checkout; ordinary rendering stays independent.
    if (await Bun.file(path.join(app, "package.json")).exists())
      await buildPresenter();
    return {
      js: await Bun.file(path.join(generated, "presenter.js")).text(),
      css: await Bun.file(path.join(generated, "presenter.css")).text(),
    };
  })());
}
