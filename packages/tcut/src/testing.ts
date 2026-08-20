import path from "node:path";
import { record } from "./recorder";
import { isVideo } from "./video";

export interface TestResult {
  file: string;
  ok: boolean;
  ms: number;
  error?: string;
}

export interface TestSummary {
  results: TestResult[];
  passed: number;
  failed: number;
}

const PATTERNS = ["**/*.video.ts", "**/*.tcut.ts"];

/** Expand files and directories into script paths. Directories are searched for `*.video.ts` / `*.tcut.ts`. */
export async function discoverScripts(inputs: string[]): Promise<string[]> {
  const files = new Set<string>();
  for (const input of inputs) {
    const abs = path.resolve(input);
    const stat = await Bun.file(abs).stat().catch(() => null);
    if (stat?.isDirectory()) {
      for (const pattern of PATTERNS) {
        for await (const match of new Bun.Glob(pattern).scan({ cwd: abs, absolute: true })) {
          if (!match.includes("/node_modules/")) files.add(match);
        }
      }
    } else if (stat?.isFile()) {
      files.add(abs);
    } else {
      throw new Error(`No such file or directory: ${input}`);
    }
  }
  return [...files].sort();
}

/** Run each script's recording in fast mode (no sleeps, no typing delay), without rendering or writing casts. */
export async function runScriptTests(inputs: string[], log: (line: string) => void = console.log): Promise<TestSummary> {
  const files = await discoverScripts(inputs);
  if (files.length === 0) throw new Error("No scripts found (looking for *.video.ts or *.tcut.ts)");
  const results: TestResult[] = [];
  log(`TAP version 14\n1..${files.length}`);
  for (const [index, file] of files.entries()) {
    const rel = path.relative(process.cwd(), file);
    const started = performance.now();
    let error: string | undefined;
    try {
      const mod = (await import(file)) as { default?: unknown };
      if (!isVideo(mod.default)) throw new Error("default export is not a defineVideo() result");
      await record(mod.default.config, mod.default.script, { fast: true });
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
    const ms = Math.round(performance.now() - started);
    results.push({ file: rel, ok: !error, ms, error });
    if (error) {
      log(`not ok ${index + 1} - ${rel} (${ms}ms)\n  ---\n${error.split("\n").map((l) => "  " + l).join("\n")}\n  ...`);
    } else {
      log(`ok ${index + 1} - ${rel} (${ms}ms)`);
    }
  }
  const failed = results.filter((r) => !r.ok).length;
  log(`\n# ${results.length - failed} passed, ${failed} failed`);
  return { results, passed: results.length - failed, failed };
}
