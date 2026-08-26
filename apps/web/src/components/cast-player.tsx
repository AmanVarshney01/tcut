import { Terminal, type TerminalHandle } from "@wterm/react";
import { type CSSProperties, useEffect, useRef, useState } from "react";
import "@wterm/react/css";

// A real terminal emulator (Ghostty's core in WASM) playing a tcut recording in the page: the text is
// selectable at every moment, the chapters the script marked are buttons, and the recording's own theme
// is applied. The emulator is browser-only, so the prerendered page shows the frame's box until it mounts.

interface CastEvent {
  t: number;
  type: string;
  data: string;
}

interface Chapter {
  title: string;
  t: number;
}

interface LoadedCast {
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
  bunVideo?: { theme?: Record<string, string> };
}

/** asciicast v2 → the visible timeline: `t.hide()` sections collapsed, chapters lifted out, like tcut's renderer. */
export function parseCast(text: string): LoadedCast {
  const lines = text.split("\n").filter((l) => l.trim());
  const header = JSON.parse(lines[0] ?? "{}") as CastHeader;
  let hiddenSince: number | null = null;
  let removed = 0;
  const events: CastEvent[] = [];
  const chapters: Chapter[] = [];
  for (const line of lines.slice(1)) {
    const [t, type, data] = JSON.parse(line) as [number, string, string];
    if (type === "m" && data === "hide") {
      hiddenSince ??= t;
      continue;
    }
    if (type === "m" && data === "show") {
      if (hiddenSince !== null) removed += t - hiddenSince;
      hiddenSince = null;
      continue;
    }
    const vt = (hiddenSince === null ? t : hiddenSince) - removed;
    if (type === "m" && data.startsWith("chapter:")) chapters.push({ title: data.slice(8), t: vt });
    else if (type === "o" || type === "r") events.push({ t: vt, type, data });
  }
  const last = events[events.length - 1];
  return { cols: header.width, rows: header.height, theme: header.bunVideo?.theme ?? null, events, chapters, duration: last ? last.t : 0 };
}

const ANSI = ["black", "red", "green", "yellow", "blue", "magenta", "cyan", "white", "brightBlack", "brightRed", "brightGreen", "brightYellow", "brightBlue", "brightMagenta", "brightCyan", "brightWhite"];

/** The recording's theme as the terminal's CSS variables, so the player matches the rendered video. */
function themeVars(theme: Record<string, string> | null): CSSProperties {
  if (!theme) return {};
  const entries: Array<[string, string]> = [
    ["--term-fg", theme.foreground ?? ""],
    ["--term-bg", theme.background ?? ""],
    ["--term-cursor", theme.cursor ?? theme.foreground ?? ""],
    ...ANSI.flatMap((name, i): Array<[string, string]> => (theme[name] ? [[`--term-color-${i}`, theme[name]]] : [])),
  ];
  // custom properties are not part of CSSProperties' declared keys, but React passes them through
  return Object.fromEntries(entries) as CSSProperties;
}

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function CastPlayer({ cast: text }: { cast: string }) {
  const [cast, setCast] = useState<LoadedCast | null>(null);
  useEffect(() => setCast(parseCast(text)), [text]); // browser only: the emulator needs the DOM and WASM
  if (!cast) return <div className="aspect-[16/9] w-full rounded-lg bg-mocha" aria-hidden="true" />;
  return <Player cast={cast} />;
}

function Player({ cast }: { cast: LoadedCast }) {
  const term = useRef<TerminalHandle | null>(null);
  const clock = useRef({ elapsed: 0, playing: true, speed: 1, pointer: 0 });
  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);

  const applyUntil = (time: number) => {
    const c = clock.current;
    while (c.pointer < cast.events.length && (cast.events[c.pointer]?.t ?? Number.POSITIVE_INFINITY) <= time) {
      const e = cast.events[c.pointer++];
      if (!e) break;
      if (e.type === "o") term.current?.write(e.data);
      else {
        const [w, h] = e.data.split("x").map(Number);
        if (w && h) term.current?.resize(w, h);
      }
    }
  };
  const seek = (time: number) => {
    term.current?.write("\x1bc");
    clock.current.pointer = 0;
    applyUntil(time);
    clock.current.elapsed = time;
    setElapsed(time);
  };
  const setPlayingBoth = (p: boolean) => {
    clock.current.playing = p;
    setPlaying(p);
  };

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const c = clock.current;
      if (c.playing) {
        // clamp the frame delta: a backgrounded tab pauses rAF and must not skip to the end on resume
        c.elapsed = Math.min(cast.duration, c.elapsed + Math.min(0.1, (now - last) / 1000) * c.speed);
        applyUntil(c.elapsed);
        setElapsed(c.elapsed);
        if (c.elapsed >= cast.duration) setPlayingBoth(false);
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [cast]);

  const vars = themeVars(cast.theme);
  return (
    <div className="overflow-hidden rounded-lg bg-mocha p-3">
      <Terminal ref={term} cols={cast.cols} rows={cast.rows} cursorBlink={false} style={vars} onData={() => {}} />
      <div className="mt-3 flex items-center gap-3 font-mono text-xs text-[#a6adc8]">
        <button
          type="button"
          onClick={() => {
            const next = !clock.current.playing;
            if (next && clock.current.elapsed >= cast.duration) seek(0);
            setPlayingBoth(next);
          }}
          className="min-w-10 rounded border border-[#45475a] px-2 py-1 hover:text-white"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? "❚❚" : "▶"}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={cast.duration ? Math.round((elapsed / cast.duration) * 1000) : 0}
          onChange={(e) => {
            setPlayingBoth(false);
            seek((Number(e.target.value) / 1000) * cast.duration);
          }}
          className="flex-1 accent-amber"
          aria-label="Seek"
        />
        <span>
          {fmt(elapsed)} / {fmt(cast.duration)}
        </span>
        <button
          type="button"
          onClick={() => {
            const v = speed === 1 ? 2 : 1;
            clock.current.speed = v;
            setSpeed(v);
          }}
          className="rounded border border-[#45475a] px-2 py-1 hover:text-white"
        >
          {speed}×
        </button>
      </div>
      {cast.chapters.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {cast.chapters.map((ch) => (
            <button
              key={ch.title}
              type="button"
              onClick={() => {
                setPlayingBoth(true);
                seek(ch.t);
              }}
              className={`rounded-full border px-3 py-0.5 font-mono text-xs ${elapsed >= ch.t ? "border-amber bg-amber text-[#11111b]" : "border-[#45475a] text-[#a6adc8]"}`}
            >
              {ch.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
