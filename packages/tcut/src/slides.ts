import { MARKER } from "./cast";

/** A transition card placed on the visible timeline (seconds). */
export interface SlideCard {
  start: number;
  end: number;
  heading: string;
  subtitle?: string;
  eyebrow?: string;
  /** Fade in / out, in timeline seconds. */
  fade: number;
}

interface SlideSpec {
  heading: string;
  subtitle?: string;
  eyebrow?: string;
  /** Requested hold in real ms; only a fallback when the recording has no `slide:end`. */
  duration: number;
  fade: number;
}

export const SLIDE_END = `${MARKER.slide}end`;

/**
 * Pair `slide:{…}` / `slide:end` markers into cards. Both markers went through the same timeline
 * (speed, timelapse, hide, idle compression), so the card covers exactly what the recording covered.
 */
export function slidesOnTimeline(events: ReadonlyArray<{ vt: number; type: string; data: string }>): SlideCard[] {
  const cards: SlideCard[] = [];
  let open: (SlideCard & { real: number }) | null = null;
  const close = (end: number | null) => {
    if (!open) return;
    if (end !== null) {
      const scale = open.real > 0 ? (end - open.start) / open.real : 1;
      open.end = end;
      open.fade = Math.min(open.fade * scale, (end - open.start) / 2);
    }
    const { real: _real, ...card } = open;
    cards.push(card);
    open = null;
  };
  for (const e of events) {
    if (e.type !== "m" || !e.data.startsWith(MARKER.slide)) continue;
    if (e.data === SLIDE_END) {
      close(e.vt);
      continue;
    }
    close(null); // a card without an end (older recording): keep its requested duration
    const spec = JSON.parse(e.data.slice(MARKER.slide.length)) as SlideSpec;
    const real = spec.duration / 1000;
    open = { start: e.vt, end: e.vt + real, heading: spec.heading, subtitle: spec.subtitle, eyebrow: spec.eyebrow, fade: Math.min(spec.fade / 1000, real / 2), real };
  }
  close(null);
  return cards;
}

/** The card on screen at `time`, and how opaque it is (0 → 1 → 0 across its fades). */
export function slideAt(cards: SlideCard[], time: number): { card: SlideCard; opacity: number } | null {
  const card = cards.find((s) => time >= s.start && time <= s.end);
  if (!card) return null;
  const into = time - card.start;
  const left = card.end - time;
  const opacity = card.fade > 0 ? Math.max(0, Math.min(1, Math.min(into / card.fade, left / card.fade))) : 1;
  return opacity > 0 ? { card, opacity } : null;
}
