import path from "node:path";
import type { CastEvent, CastHeader, Recording } from "./types";

/** Serialise to asciicast v2 (newline-delimited JSON). Playable with `asciinema play`. */
export function serializeCast(rec: Recording): string {
  const lines = [JSON.stringify(rec.header)];
  for (const event of rec.events) lines.push(JSON.stringify(event));
  return lines.join("\n") + "\n";
}

export function parseCast(text: string): Recording {
  const lines = text.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length === 0) throw new Error("Empty cast file");
  const header = JSON.parse(lines[0]!) as CastHeader;
  if (header.version !== 2) throw new Error(`Unsupported cast version ${String(header.version)} (expected 2)`);
  const events: CastEvent[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parsed = JSON.parse(lines[i]!) as unknown;
    if (!Array.isArray(parsed) || parsed.length < 3) throw new Error(`Malformed cast event on line ${i + 1}`);
    const type = parsed[1] as CastEvent[1];
    if (!["o", "i", "r", "m", "b"].includes(type)) continue; // tolerate unknown asciicast event types
    events.push([Number(parsed[0]), type, String(parsed[2])]);
  }
  return { header, events };
}

export async function writeCast(file: string, rec: Recording): Promise<void> {
  await Bun.write(file, serializeCast(rec));
}

export async function readCast(file: string): Promise<Recording> {
  const abs = path.resolve(file);
  const f = Bun.file(abs);
  if (!(await f.exists())) throw new Error(`Cast file not found: ${file}`);
  const rec = parseCast(await f.text());
  rec.source = abs;
  return rec;
}

export const MARKER = {
  hide: "hide",
  show: "show",
  screenshot: "screenshot:",
  focus: "focus:",
  end: "end",
} as const;
