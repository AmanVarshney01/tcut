import { MARKER } from "./cast";
import type { CastEvent } from "./types";

export interface TimedEvent {
  /** Time on the visible (hide-collapsed, speed-adjusted) timeline, seconds. */
  vt: number;
  type: CastEvent[1];
  data: string;
}

export interface Timeline {
  events: TimedEvent[];
  duration: number;
}

/**
 * Collapse hidden intervals and apply playback speed. Hidden events keep their relative order but all land
 * on the instant the hide started, so the first visible frame after `show` reflects their combined effect.
 * Input (`i`) events are dropped: the PTY already echoed them.
 */
export function buildTimeline(events: CastEvent[], playbackSpeed: number): Timeline {
  const out: TimedEvent[] = [];
  let hiddenSince: number | null = null;
  let removed = 0;
  let duration = 0;

  for (const [t, type, data] of events) {
    if (type === "m" && data === MARKER.hide) {
      if (hiddenSince === null) hiddenSince = t;
      continue;
    }
    if (type === "m" && data === MARKER.show) {
      if (hiddenSince !== null) {
        removed += t - hiddenSince;
        hiddenSince = null;
      }
      continue;
    }
    if (type === "i") continue;
    const visible = hiddenSince === null ? t - removed : hiddenSince - removed;
    const vt = visible / playbackSpeed;
    out.push({ vt, type, data });
    if (vt > duration) duration = vt;
  }
  return { events: out, duration };
}

const FULL_RESET = "\x1bc";

/** Re-emit `inject` right after any full terminal reset (`ESC c`) so injected state (e.g. palette) survives `reset`. */
export function withReinjection(events: TimedEvent[], inject: string): TimedEvent[] {
  const out: TimedEvent[] = [];
  for (const e of events) {
    out.push(e);
    if (e.type === "o" && e.data.includes(FULL_RESET)) out.push({ vt: e.vt, type: "o", data: inject });
  }
  return out;
}
