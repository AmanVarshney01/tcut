// Browser-side entry, bundled by Bun.build and loaded as an ES module inside Bun.WebView.
// The renderer drives it through the window.__vt* functions; payloads arrive via fetch() from the local server.
import { WasmBridge, type TerminalCore } from "@wterm/core";
import { WTerm } from "@wterm/dom";
import { GhosttyCore } from "@wterm/ghostty";

interface BootOptions {
  cols: number;
  rows: number;
  foreground: string;
  background: string;
  wasmUrl: string;
  core: "ghostty" | "lite";
}

interface BatchEvent {
  type: "o" | "r";
  data: string;
}

let term: WTerm | null = null;

const paint = (): Promise<boolean> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve(true))));

const api = {
  async boot(opts: BootOptions): Promise<boolean> {
    const core: TerminalCore =
      opts.core === "lite"
        ? await WasmBridge.load()
        : await GhosttyCore.load({
            wasmPath: opts.wasmUrl,
            foregroundColor: opts.foreground,
            backgroundColor: opts.background,
          });
    const el = document.getElementById("term")!;
    term = new WTerm(el, {
      cols: opts.cols,
      rows: opts.rows,
      core,
      autoResize: false,
      cursorBlink: false,
      onData: () => {},
    });
    await term.init();
    el.classList.add("focused");
    if (document.fonts?.ready) await document.fonts.ready;
    await paint();
    return true;
  },

  measure(): { w: number; h: number } {
    const t = term as unknown as { _charWidth?: number; _rowHeight?: number } | null;
    if (t && t._charWidth && t._rowHeight && t._charWidth > 0 && t._rowHeight > 0) {
      return { w: t._charWidth, h: t._rowHeight };
    }
    const row = document.createElement("div");
    row.className = "term-row";
    row.style.cssText = "position:absolute;visibility:hidden";
    const span = document.createElement("span");
    span.textContent = "W";
    row.appendChild(span);
    document.querySelector(".term-grid")!.appendChild(row);
    const w = span.getBoundingClientRect().width;
    const h = row.getBoundingClientRect().height;
    row.remove();
    return { w, h };
  },

  layout(frameW: number, frameH: number, termW: number, termH: number, padX?: number, padY?: number): boolean {
    const frame = document.getElementById("frame")!;
    frame.style.width = `${frameW}px`;
    frame.style.height = `${frameH}px`;
    if (padX !== undefined && padY !== undefined) frame.style.padding = `${padY}px ${padX}px`;
    const browser = document.getElementById("browser");
    const stage = document.getElementById("stage");
    const stacked = stage ? /column/.test(getComputedStyle(stage).flexDirection) : false;
    const overlay = getComputedStyle(frame).position === "absolute"; // overlay: size comes from browserOffset()
    if (browser && !overlay) {
      if (stacked) browser.style.width = `${frameW}px`;
      else browser.style.height = `${frameH}px`;
    }
    const el = document.getElementById("term")!;
    el.style.width = `${termW}px`;
    el.style.height = `${termH}px`;
    return true;
  },

  /** Overlay layout: place the browser window at an offset from the terminal window. */
  browserOffset(x: number, y: number, w: number, h: number): boolean {
    const browser = document.getElementById("browser");
    if (!browser) return false;
    browser.style.left = `${x}px`;
    browser.style.top = `${y}px`;
    browser.style.width = `${w}px`;
    browser.style.height = `${h}px`;
    return true;
  },

  /** Overlay layout: which window is in front. */
  focus(target: "terminal" | "browser"): boolean {
    document.getElementById("stage")?.classList.toggle("front-browser", target === "browser");
    return true;
  },

  /** Show a captured browser frame (served by the renderer) and wait until it has loaded and painted. */
  browserFrame(url: string, label?: string): Promise<boolean> {
    const img = document.getElementById("bframe") as HTMLImageElement | null;
    if (!img) return Promise.resolve(false);
    if (label !== undefined) {
      const bar = document.getElementById("browser-url");
      if (bar) bar.textContent = label;
    }
    return new Promise((resolve) => {
      img.onload = () => paint().then(() => resolve(true));
      img.onerror = () => resolve(false);
      img.src = url;
    });
  },

  /** Fetch a JSON array of events from `url` and apply them, then wait for a paint. */
  async applyUrl(url: string): Promise<boolean> {
    const events = (await (await fetch(url)).json()) as BatchEvent[];
    for (const e of events) {
      if (e.type === "o") term!.write(e.data);
      else if (e.type === "r") {
        const [c, r] = e.data.split("x").map(Number);
        if (c! > 0 && r! > 0) term!.resize(c!, r!);
      }
    }
    await paint();
    return true;
  },

  /** Fetch raw text from `url` and write it to the terminal (used for theme OSC sequences). */
  async writeUrl(url: string): Promise<boolean> {
    term!.write(await (await fetch(url)).text());
    await paint();
    return true;
  },

  cursor(visible: boolean): boolean {
    document.getElementById("blink")!.textContent = visible
      ? ""
      : ".wterm.focused .term-cursor{background:transparent!important;color:inherit!important;outline:none!important}";
    return true;
  },
};

(window as unknown as { __vt: typeof api }).__vt = api;
