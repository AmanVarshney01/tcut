// Browser-side player for `.html` exports. Uses wterm's lite core (inline WASM) so the file is self-contained.
import { WasmBridge } from "@wterm/core";
import { pinGlyphs } from "./pin";
import { WTerm } from "@wterm/dom";
import { extractTitle } from "../osc";

interface PlayerData {
  cols: number;
  rows: number;
  duration: number;
  speed: number;
  /** Follow OSC 0/2 titles from the recording in the window bar. */
  autoTitle?: boolean;
  events: Array<{ vt: number; type: "o" | "r"; data: string }>;
  slides?: Array<{ start: number; end: number; heading: string; subtitle?: string; eyebrow?: string; fade: number }>;
}

const dataEl = document.getElementById("tcut-cast");
if (!dataEl) throw new Error("tcut player: missing cast data");
const data = JSON.parse(dataEl.textContent || "{}") as PlayerData;

const el = document.getElementById("term")!;
const playBtn = document.getElementById("play") as HTMLButtonElement;
const progress = document.getElementById("progress") as HTMLInputElement;
const loopBox = document.getElementById("loop") as HTMLInputElement;
const timeLabel = document.getElementById("time")!;

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

(async () => {
  const core = await WasmBridge.load();
  const term = new WTerm(el, { cols: data.cols, rows: data.rows, core, autoResize: false, cursorBlink: true, onData: () => {} });
  await term.init();
  el.classList.add("focused");

  let pointer = 0;
  let elapsed = 0; // seconds on the visible timeline
  let playing = false;
  let last = 0;
  let raf = 0;

  const reset = () => {
    term.write("\x1bc");
    term.resize(data.cols, data.rows);
    pointer = 0;
    elapsed = 0;
  };

  const applyUntil = (time: number) => {
    while (pointer < data.events.length && data.events[pointer]!.vt <= time) {
      const e = data.events[pointer++]!;
      if (e.type === "o") {
        term.write(e.data);
        if (data.autoTitle) {
          const t = extractTitle(e.data);
          if (t !== null) {
            const bar = document.querySelector("#bar .title");
            if (bar) bar.textContent = t;
          }
        }
      } else if (e.type === "r") {
        const [c, r] = e.data.split("x").map(Number);
        if (c! > 0 && r! > 0) term.resize(c!, r!);
      }
    }
  };

  const slideEl = document.getElementById("slide");
  /** The transition card at `time`, faded in and out like the raster renderer. */
  const updateSlide = (time: number) => {
    if (!slideEl || !data.slides?.length) return;
    const card = data.slides.find((s) => time >= s.start && time <= s.end);
    let opacity = 0;
    if (card) {
      const into = time - card.start;
      const left = card.end - time;
      opacity = card.fade > 0 ? Math.max(0, Math.min(1, Math.min(into / card.fade, left / card.fade))) : 1;
      const heading = slideEl.querySelector("h1")!;
      if (heading.textContent !== card.heading) {
        heading.textContent = card.heading;
        const fit = Math.min(1, 22 / Math.max(1, card.heading.length));
        heading.style.fontSize = fit < 1 ? `calc(${getComputedStyle(heading).fontSize} * ${fit.toFixed(3)})` : "";
        const eyebrow = slideEl.querySelector(".eyebrow") as HTMLElement;
        eyebrow.textContent = card.eyebrow ?? "";
        eyebrow.style.display = card.eyebrow ? "" : "none";
        const sub = slideEl.querySelector(".sub") as HTMLElement;
        sub.textContent = card.subtitle ?? "";
        sub.style.display = card.subtitle ? "" : "none";
      }
    }
    slideEl.style.opacity = String(opacity);
    slideEl.style.transform = `translateY(${((1 - opacity) * 14).toFixed(2)}px)`;
  };

  const updateUi = () => {
    updateSlide(elapsed);
    progress.value = String(Math.min(1000, Math.round((elapsed / data.duration) * 1000)));
    timeLabel.textContent = `${fmt(elapsed)} / ${fmt(data.duration)}`;
    playBtn.textContent = playing ? "❚❚" : "▶";
  };

  const tick = (now: number) => {
    if (!playing) return;
    elapsed += ((now - last) / 1000) * data.speed;
    last = now;
    applyUntil(elapsed);
    pinGlyphs(el);
    if (elapsed >= data.duration) {
      if (loopBox.checked) {
        reset();
      } else {
        playing = false;
        elapsed = data.duration;
      }
    }
    updateUi();
    if (playing) raf = requestAnimationFrame(tick);
  };

  const play = () => {
    if (playing) return;
    if (elapsed >= data.duration) reset();
    playing = true;
    last = performance.now();
    raf = requestAnimationFrame(tick);
    updateUi();
  };
  const pause = () => {
    playing = false;
    cancelAnimationFrame(raf);
    updateUi();
  };

  playBtn.addEventListener("click", () => (playing ? pause() : play()));
  progress.addEventListener("input", () => {
    const target = (Number(progress.value) / 1000) * data.duration;
    if (target < elapsed) reset();
    elapsed = target;
    applyUntil(elapsed);
    updateUi();
  });
  el.addEventListener("click", () => (playing ? pause() : play()));

  applyUntil(0);
  updateUi();
  play();
})();
