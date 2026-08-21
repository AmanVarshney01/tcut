import { WINDOW_BAR_HEIGHT, estimateCell } from "./config";
import { toMs } from "./duration";
import { WaitTimeoutError } from "./errors";
import type { BrowserFrame, BrowserSession, ResolvedConfig } from "./types";

export interface BrowserCapture extends BrowserSession {
  /** Frames captured so far (only when the page's pixels changed). */
  frames: BrowserFrame[];
  /** Stop sampling and close the WebView. */
  stop(): Promise<void>;
}

const toRegExp = (pattern: RegExp | string): RegExp =>
  typeof pattern === "string" ? new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) : pattern;

/**
 * A Bun.WebView sampled on the recording clock, shared by scripted and live recording. Only changed frames are
 * kept; every WebView call is bounded by a timeout so a stuck page can never hang a recording.
 */
export function startBrowserCapture(config: ResolvedConfig, stamp: () => number, log: (m: string) => void = () => {}): BrowserCapture {
  if (!config.browser) throw new Error("startBrowserCapture needs config.browser");
  if (typeof Bun.WebView !== "function") throw new Error("The browser pane needs Bun.WebView (Bun >= 1.4).");
  const bcfg = config.browser;

  // Default pane size: match the terminal window (estimated from the font metrics) unless given.
  const est = estimateCell(config.font);
  const termFrameH = Math.round(config.rows * est.h + config.padding * 2 + (config.windowBar === "none" ? 0 : WINDOW_BAR_HEIGHT));
  const termFrameW = Math.round(config.cols * est.w + config.padding * 2);
  const stacked = bcfg.position === "top" || bcfg.position === "bottom";
  const paneW = stacked ? termFrameW : bcfg.width;
  const paneH = bcfg.height || (stacked || bcfg.position === "overlay" ? 480 : termFrameH);
  const view = new Bun.WebView({ width: paneW, height: paneH });

  const frames: BrowserFrame[] = [];
  const within = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([promise, Bun.sleep(ms).then(() => Promise.reject(new Error(`browser.${label} did not finish within ${ms}ms`)))]);

  let currentUrl = bcfg.url ?? "about:blank";
  let lastHash = "";
  let running = true;
  const sampler = (async () => {
    while (running) {
      try {
        const png = (await within(view.screenshot({ encoding: "buffer" }), 5000, "screenshot")) as Uint8Array;
        const hash = Bun.hash(png).toString(16);
        if (hash !== lastHash) {
          lastHash = hash;
          frames.push({ time: stamp(), png });
        }
      } catch {
        /* view busy or closed */
      }
      await Bun.sleep(1000 / bcfg.fps);
    }
  })();

  /**
   * Navigate and wait for the page to be there. Dev servers may still be starting (connection refused → retry)
   * or take a long first load (Vite pre-bundling, then a reload), so success is judged by the document's
   * readyState at the target URL rather than by the navigate() promise alone.
   */
  const goto = async (url: string): Promise<void> => {
    const deadline = performance.now() + config.waitTimeout;
    const target = url.replace(/\/$/, "");
    let navigation: Promise<"ok" | "pending" | "failed"> | null = null;
    for (;;) {
      navigation ??= view.navigate(url).then(
        () => "ok" as const,
        (err: unknown) => (/pending/i.test(String(err)) ? ("pending" as const) : ("failed" as const)),
      );
      const outcome = await Promise.race([navigation, Bun.sleep(750).then(() => "tick" as const)]);
      if (outcome === "ok") {
        currentUrl = url;
        return;
      }
      if (outcome === "failed") navigation = null;
      const state = await within(view.evaluate("document.readyState"), 3000, "goto").catch(() => "");
      if (state === "complete" && (view.url ?? "").replace(/\/$/, "").startsWith(target)) {
        currentUrl = url;
        return;
      }
      if (performance.now() > deadline) {
        throw new WaitTimeoutError(`browser.goto(${url})`, config.waitTimeout, `current url: ${view.url ?? "(none)"}, readyState: ${state || "unknown"}`);
      }
      await Bun.sleep(250);
    }
  };

  const capture: BrowserCapture = {
    frames,
    get url() {
      return currentUrl;
    },
    goto,
    async waitFor(pattern, waitOpts = {}) {
      const regex = toRegExp(pattern);
      const timeout = toMs(waitOpts.timeout, config.waitTimeout);
      const deadline = performance.now() + timeout;
      for (;;) {
        const text = String((await within(view.evaluate("document.body ? document.body.innerText : ''"), 5000, "waitFor").catch(() => "")) ?? "");
        if (regex.test(text)) return;
        if (performance.now() > deadline) throw new WaitTimeoutError(`${regex} in the browser page`, timeout, text.slice(0, 2000));
        await Bun.sleep(150);
      }
    },
    click: (selector) => within(view.click(selector), 10000, "click"),
    reload: () => within(view.reload(), 30000, "reload").catch((err) => (/pending/i.test(String(err)) ? undefined : Promise.reject(err))),
    evaluate: (js) => within(view.evaluate(js), 10000, "evaluate"),
    async stop() {
      running = false;
      await sampler;
      try {
        view.close();
      } catch {
        /* closed */
      }
    },
  };

  if (bcfg.url) void goto(bcfg.url).catch((err) => log(String(err)));
  return capture;
}
