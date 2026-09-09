import { MARKER } from "./markers";
import type { CaptionOptions, CastEvent } from "./types";

export interface CaptionSpec extends Omit<CaptionOptions, "duration"> {
  text: string;
  duration?: number;
  id?: string;
}

export interface CaptionCue {
  start: number;
  end?: number;
  caption: CaptionSpec;
}

const END = `${MARKER.caption}end:`;

/** Materialize expiry before time transforms. Normalized markers are safe to flatten repeatedly. */
export function expandCaptionEvents(events: CastEvent[]): CastEvent[] {
  const out: CastEvent[] = [];
  const last = events.at(-1)?.[0] ?? 0;
  let expanded = false;
  events.forEach((event, index) => {
    const [t, type, data] = event;
    if (type !== "m" || !data.startsWith(`${MARKER.caption}{`)) {
      out.push(event);
      return;
    }
    const spec = JSON.parse(data.slice(MARKER.caption.length)) as CaptionSpec;
    if (spec.duration === undefined) {
      out.push(event);
      return;
    }
    expanded = true;
    const { duration, ...caption } = spec;
    caption.id = `caption-${index}-${t}`;
    out.push([t, type, `${MARKER.caption}${JSON.stringify(caption)}`]);
    const end = t + duration / 1000;
    if (end <= last) out.push([end, "m", `${END}${caption.id}`]);
  });
  return expanded ? out.sort((a, b) => a[0] - b[0]) : events;
}

/** Markers already share the visible clock with terminal output. Replacement cancels old expiry. */
export function captionsOnTimeline(events: ReadonlyArray<{ vt: number; type: string; data: string }>): CaptionCue[] {
  const cues: CaptionCue[] = [];
  let open: CaptionCue | undefined;
  for (const e of events) {
    if (e.type !== "m" || !e.data.startsWith(MARKER.caption)) continue;
    if (e.data.startsWith(END) && e.data.slice(END.length) !== open?.caption.id) continue;
    if (open) open.end = e.vt;
    open = undefined;
    if (e.data === `${MARKER.caption}null` || e.data.startsWith(END)) continue;
    const caption = JSON.parse(e.data.slice(MARKER.caption.length)) as CaptionSpec;
    open = { start: e.vt, caption };
    cues.push(open);
  }
  return cues;
}

export interface CaptionPresentation {
  text: string;
  position: "top" | "bottom";
  fontSize: number;
  weight: number;
  color: string;
  background: string;
  highlightColor: string;
  activeWord: number;
  outline: number;
  scale: number;
}

/** Deterministic animation: seeking, HTML playback and offline exports use the same clock. */
export function captionAt(cues: CaptionCue[], time: number): CaptionPresentation | null {
  const cue = cues.find((c) => time >= c.start && (c.end === undefined || time < c.end));
  if (!cue) return null;
  const c = cue.caption;
  const style = c.style ?? "classic";
  const bold = style === "tiktok" || style === "pop";
  const words = c.text.trim().split(/\s+/).length;
  const elapsed = Math.max(0, time - cue.start);
  const span = cue.end === undefined ? words * 0.35 : cue.end - cue.start;
  return {
    text: c.text,
    position: c.position ?? "bottom",
    fontSize: c.fontSize ?? (bold ? 40 : style === "minimal" ? 24 : 28),
    weight: bold ? 900 : 600,
    color: c.color ?? (style === "pop" ? "#ffe14a" : "#ffffff"),
    background: c.background ?? (style === "classic" ? "#111118dd" : "transparent"),
    highlightColor: c.highlightColor ?? "#baff29",
    activeWord: style === "tiktok" ? Math.min(words - 1, Math.floor(elapsed / Math.max(0.001, span) * words)) : -1,
    outline: bold ? 2 : 0,
    scale: style === "pop" && elapsed < 0.3 ? Number((1 - 0.22 * Math.exp(-elapsed * 15) * Math.cos(elapsed * 24)).toFixed(4)) : 1,
  };
}

export { CAPTION_CSS, paintCaption } from "./renderer/caption";
