export const MARKER = {
  hide: "hide",
  show: "show",
  screenshot: "screenshot:",
  focus: "focus:",
  zoom: "zoom:",
  chapter: "chapter:",
  /** Render-clock speed for the events that follow (`speed:8`); `speed:1` restores real time. */
  speed: "speed:",
  /** A full-frame transition card drawn at render time (`slide:{json}`). */
  slide: "slide:",
  end: "end",
} as const;
