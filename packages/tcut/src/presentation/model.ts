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

export interface TakeCue {
  /** Seconds since this take started. */
  at: number;
  /** Absolute position in the immutable source video. */
  source: number;
  /** 0 freezes the current source frame. */
  rate: number;
}

export interface PresentationTake {
  version: 1;
  id: string;
  presentationId: string;
  title: string;
  createdAt: string;
  duration: number;
  cues: TakeCue[];
  audio?: string;
}

export interface TakeDraft {
  title: string;
  duration: number;
  cues: TakeCue[];
}

/** Untrusted JSON is validated at the HTTP/file boundary before it can drive ffmpeg. */
export function validateTake(draft: TakeDraft, manifest: PresentationManifest): void {
  if (!Number.isFinite(draft.duration) || draft.duration <= 0 || draft.duration > 7200) throw new Error("A take must be between 0 and 7200 seconds");
  if (!Array.isArray(draft.cues) || !draft.cues.length || draft.cues.length > 20_000) throw new Error("A take needs between 1 and 20000 playback cues");
  if (!draft.title?.trim() || draft.title.length > 200) throw new Error("Take title must contain 1–200 characters");
  let previous = -1;
  for (const cue of draft.cues) {
    if (!Number.isFinite(cue.at) || cue.at < 0 || cue.at < previous || cue.at > draft.duration) throw new Error("Take cues must be ordered within the take");
    if (!Number.isFinite(cue.source) || cue.source < 0 || cue.source > manifest.duration - 1 / manifest.fps + 1e-6) throw new Error("Take cue is outside the source recording");
    if (!Number.isFinite(cue.rate) || (cue.rate !== 0 && (cue.rate < 0.25 || cue.rate > 4))) throw new Error("Playback rate must be 0 or between 0.25 and 4");
    previous = cue.at;
  }
  if (draft.cues[0]!.at !== 0) throw new Error("The first take cue must start at zero");
}

export interface TakeSegment { source: number; rate: number; frames: number; duration: number }

/** Quantize cumulative boundaries, avoiding one-frame drift for every pause/seek. */
export function takeSegments(take: TakeDraft, fps: number): TakeSegment[] {
  const segments: TakeSegment[] = [];
  for (let i = 0; i < take.cues.length; i++) {
    const cue = take.cues[i]!;
    const end = take.cues[i + 1]?.at ?? take.duration;
    const frames = Math.max(0, Math.round(end * fps) - Math.round(cue.at * fps));
    if (frames) segments.push({ source: cue.source, rate: cue.rate, frames, duration: frames / fps });
  }
  return segments;
}
