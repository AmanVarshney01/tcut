import { MARKER } from "../markers";
import type { TimedEvent } from "../timeline";

export interface PresentationStep {
  id: string;
  title: string;
  notes: string;
  /** Frame-aligned positions in the prepared source video, in seconds. End is exclusive. */
  start: number;
  end: number;
  clip: string;
  poster: string;
}

export interface PresentationManifest {
  version: 1;
  id: string;
  title: string;
  fps: number;
  width: number;
  height: number;
  duration: number;
  steps: PresentationStep[];
}

interface StepMarker { id: string; title: string; notes?: string }

/** Explicit steps win; older recordings use chapters, or one whole-recording step. */
export function presentationSteps(events: TimedEvent[], duration: number, fps: number): PresentationStep[] {
  const explicit = events.some((e) => e.type === "m" && e.data.startsWith(`${MARKER.step}{`));
  const ranges: Array<StepMarker & { start: number; end: number }> = [];
  let open: (StepMarker & { start: number; end: number }) | undefined;
  for (const e of events) {
    if (e.type !== "m") continue;
    if (explicit && e.data.startsWith(MARKER.stepEnd)) {
      if (open?.id === e.data.slice(MARKER.stepEnd.length)) { open.end = e.vt; open = undefined; }
    } else if (explicit ? e.data.startsWith(`${MARKER.step}{`) : e.data.startsWith(MARKER.chapter)) {
      if (open) open.end = e.vt;
      const spec: StepMarker = explicit ? JSON.parse(e.data.slice(MARKER.step.length)) : { id: `chapter-${ranges.length + 1}`, title: e.data.slice(MARKER.chapter.length) };
      open = { ...spec, start: e.vt, end: duration };
      ranges.push(open);
    }
  }
  if (!ranges.length) ranges.push({ id: "demo", title: "Demo", start: 0, end: duration });
  // Explicit steps intentionally exclude setup outside their callbacks. Old chapter recordings keep their intro.
  if (!explicit && ranges[0]!.start > 0) ranges.unshift({ id: "intro", title: "Introduction", start: 0, end: ranges[0]!.start });
  const totalFrames = Math.max(1, Math.ceil(duration * fps));
  return ranges.map((r, i) => {
    const startFrame = Math.min(totalFrames - 1, Math.max(0, Math.ceil(r.start * fps - 1e-6)));
    const endFrame = Math.min(totalFrames, Math.max(startFrame + 1, Math.ceil(r.end * fps - 1e-6)));
    return { id: `step-${i + 1}`, title: r.title, notes: r.notes ?? "", start: startFrame / fps, end: endFrame / fps, clip: `step-${i + 1}.mp4`, poster: `step-${i + 1}.jpg` };
  });
}
