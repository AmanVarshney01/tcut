/** Resolve a `loopOffset` (frame count or "N%") to a frame index in `[0, total)`. */
export function loopOffsetFrames(total: number, value: number | string | undefined): number {
  if (!value || total <= 1) return 0;
  const m = /^\s*(-?\d+(?:\.\d+)?)\s*(%?)\s*$/.exec(String(value));
  if (!m) throw new Error(`Invalid loopOffset "${value}" (use a frame count or a percentage like "50%")`);
  const frames = m[2] ? Math.round((Number(m[1]) / 100) * total) : Math.round(Number(m[1]));
  return ((frames % total) + total) % total;
}

/** Start the sequence at `offset`, appending the frames before it at the end. */
export function rotateFrames<T>(frames: T[], offset: number): T[] {
  if (offset <= 0 || offset >= frames.length) return frames;
  return [...frames.slice(offset), ...frames.slice(0, offset)];
}

/** Where the terminal grid sits inside the frame, and the final (even-sized) video dimensions. */
export interface FrameFit {
  frameW: number;
  frameH: number;
  padX: number;
  padY: number;
  width: number;
  height: number;
}

/** Place the terminal grid inside a frame of the requested size (or wrap it tightly when no size is requested). */
export function fitFrame(opts: {
  termW: number;
  termH: number;
  padding: number;
  margin: number;
  bar: number;
  width?: number;
  height?: number;
}): FrameFit {
  const even = (n: number) => (n % 2 === 0 ? n : n + 1);
  let frameW = opts.termW + opts.padding * 2;
  let frameH = opts.termH + opts.padding * 2 + opts.bar;
  let padX = opts.padding;
  let padY = opts.padding;
  if (opts.width !== undefined || opts.height !== undefined) {
    const targetW = (opts.width ?? frameW + opts.margin * 2) - opts.margin * 2;
    const targetH = (opts.height ?? frameH + opts.margin * 2) - opts.margin * 2;
    frameW = Math.max(opts.termW, targetW);
    frameH = Math.max(opts.termH + opts.bar, targetH);
    padX = Math.floor((frameW - opts.termW) / 2);
    padY = Math.floor((frameH - opts.bar - opts.termH) / 2);
  }
  return { frameW, frameH, padX, padY, width: even(frameW + opts.margin * 2), height: even(frameH + opts.margin * 2) };
}
