import { MARKER } from "./cast";
import type { CastEvent } from "./types";

export interface TimedEvent {
  /** Time on the visible (hide-collapsed, speed-adjusted, idle-compressed) timeline, seconds. */
  vt: number;
  type: CastEvent[1];
  data: string;
}

export interface Timeline {
  events: TimedEvent[];
  duration: number;
}

export interface TimelineOptions {
  /** Keep `i` (input) events; the renderer needs them for the key overlay. Default false. */
  keepInput?: boolean;
  /** Cap any gap between consecutive events to this many seconds (idle compression). */
  maxPause?: number;
}

/**
 * Collapse hidden intervals, apply playback speed (global and per `speed:` segment), optionally cap idle gaps.
 * Hidden events keep their relative order but all land on the instant the hide started, so the first visible
 * frame after `show` reflects their combined effect. Input (`i`) events are dropped unless `keepInput`: the PTY
 * already echoed them.
 */
export function buildTimeline(events: CastEvent[], playbackSpeed: number, opts: TimelineOptions = {}): Timeline {
  const out: TimedEvent[] = [];
  let hiddenSince: number | null = null;
  let removed = 0;
  // Visible time accumulates per segment: (collapsed time since the last event) / (global × segment speed).
  let segmentSpeed = 1;
  let lastCollapsed = 0;
  let vt = 0;
  const advance = (t: number): number => {
    const collapsed = hiddenSince === null ? t - removed : hiddenSince - removed;
    vt += Math.max(0, collapsed - lastCollapsed) / (playbackSpeed * segmentSpeed);
    lastCollapsed = collapsed;
    return vt;
  };

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
    if (type === "m" && data.startsWith(MARKER.speed)) {
      advance(t);
      const speed = Number(data.slice(MARKER.speed.length));
      segmentSpeed = Number.isFinite(speed) && speed > 0 ? speed : 1;
      continue;
    }
    if (type === "i" && !opts.keepInput) continue;
    out.push({ vt: advance(t), type, data });
  }

  if (opts.maxPause !== undefined && opts.maxPause >= 0) {
    // Walk forward; whenever the next event is further away than maxPause, pull everything after it closer.
    let shift = 0;
    let prev: number | null = null;
    for (const e of out) {
      const original = e.vt;
      if (prev !== null && original - prev > opts.maxPause) shift += original - prev - opts.maxPause;
      prev = original;
      e.vt = original - shift;
    }
  }

  let duration = 0;
  for (const e of out) if (e.vt > duration) duration = e.vt;
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
