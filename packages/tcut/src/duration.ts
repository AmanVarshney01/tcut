import type { Duration } from "./types";

const unitMs = (unit: string | undefined): number => (unit === "s" ? 1000 : unit === "m" ? 60_000 : 1);

/** "500ms" → 500, "1.5s" → 1500, "2m" → 120000, 250 → 250. Bare numbers are milliseconds. */
export function toMs(value: Duration | undefined, fallback = 0): number {
  if (value === undefined) return fallback;
  // Numbers and strings share one grammar: a non-negative decimal with an optional unit.
  const match = /^\s*(\d+(?:\.\d+)?)\s*(ms|s|m)?\s*$/.exec(String(value));
  if (!match) throw new Error(`Invalid duration "${value}" (use e.g. 500, "500ms", "1.5s", "2m")`);
  return Number(match[1]) * unitMs(match[2]);
}

export function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`;
}
