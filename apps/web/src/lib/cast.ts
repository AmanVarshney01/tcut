import { buildTimeline } from "termcut/timeline";

interface CastEvent {
  t: number;
  type: string;
  data: string;
}

interface Chapter {
  title: string;
  t: number;
}

export interface LoadedCast {
  cols: number;
  rows: number;
  theme: Record<string, string> | null;
  events: CastEvent[];
  chapters: Chapter[];
  duration: number;
}

interface CastHeader {
  width: number;
  height: number;
  bunVideo?: { theme?: Record<string, string>; playbackSpeed?: number; maxPause?: number };
}

/** Play the same visible timeline as the CLI, including speed changes and the final hold. */
export function parseCast(text: string): LoadedCast {
  const lines = text.split("\n").filter((line) => line.trim());
  const header = JSON.parse(lines[0] ?? "{}") as CastHeader;
  const raw = lines.slice(1).map((line) => JSON.parse(line) as [number, "o" | "i" | "r" | "m" | "b", string]);
  const timeline = buildTimeline(raw, header.bunVideo?.playbackSpeed ?? 1, { maxPause: header.bunVideo?.maxPause });
  const events: CastEvent[] = [];
  const chapters: Chapter[] = [];
  for (const { vt, type, data } of timeline.events) {
    if (type === "m" && data.startsWith("chapter:")) chapters.push({ title: data.slice(8), t: vt });
    else if (type === "o" || type === "r") events.push({ t: vt, type, data });
  }
  return { cols: header.width, rows: header.height, theme: header.bunVideo?.theme ?? null, events, chapters, duration: timeline.duration };
}
