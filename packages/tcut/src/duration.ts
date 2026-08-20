import type { Duration } from "./types";

const units: Record<string, number> = { ms: 1, s: 1000, m: 60_000 };

/** "500ms" → 500, "1.5s" → 1500, "2m" → 120000, 250 → 250. Bare numbers are milliseconds. */
export function toMs(value: Duration | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid duration ${value}`);
    return value;
  }
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m)?\s*$/.exec(value);
  if (!match) throw new Error(`Invalid duration "${value}" (use e.g. 500, "500ms", "1.5s", "2m")`);
  const unit = match[2] ?? "ms";
  return Number(match[1]) * units[unit]!;
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}
