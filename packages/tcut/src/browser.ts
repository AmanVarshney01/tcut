import { WINDOW_BAR_HEIGHT, estimateCell } from "./config";
import { createWebView } from "./renderer/view";
import { toMs } from "./duration";
import { WaitTimeoutError } from "./errors";
import type { BrowserFrame, BrowserSession, ResolvedConfig } from "./types";

export interface BrowserCapture extends BrowserSession {
  /** Frames captured so far (only when the page's pixels changed). */
  frames: BrowserFrame[];
  /** Stop sampling and close the WebView. */
  stop(): Promise<void>;
}

/** "better-t-stack.dev" → "https://better-t-stack.dev"; localhost defaults to http. */
export function normalizeUrl(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(url) || /^(about|data|file|blob):/i.test(url)) return url;
  return /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(url) ? `http://${url}` : `https://${url}`;
}

const toRegExp = (pattern: RegExp | string): RegExp =>
  pattern instanceof RegExp ? pattern : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

/**
 * A Bun.WebView sampled on the recording clock, shared by scripted and live recording. Only changed frames are
 * kept; every WebView call is bounded by a timeout so a stuck page can never hang a recording.
 */
export function startBrowserCapture(config: ResolvedConfig, stamp: () => number, log: (m: string) => void = () => {}): BrowserCapture {
  if (!config.browser) throw new Error("startBrowserCapture needs config.browser");

  const bcfg = config.browser;

  // Default pane size: match the terminal window (estimated from the font metrics) unless given.
  const est = estimateCell(config.font);
  const termFrameH = Math.round(config.rows * est.h + config.padding * 2 + (config.windowBar === "none" ? 0 : WINDOW_BAR_HEIGHT));
  const termFrameW = Math.round(config.cols * est.w + config.padding * 2);
  const stacked = bcfg.position === "top" || bcfg.position === "bottom";
  const paneW = stacked ? termFrameW : bcfg.width;
  const paneH = bcfg.height || (stacked || bcfg.position === "overlay" ? 480 : termFrameH);
  const view = createWebView({ width: paneW, height: paneH });

  const frames: BrowserFrame[] = [];
  const within = <T,>(promise: Promise<T>, ms: number, label: string): Promise<T> =>
    Promise.race([promise, Bun.sleep(ms).then(() => Promise.reject(new Error(`browser.${label} did not finish within ${ms}ms`)))]);

  let currentUrl = bcfg.url ?? "about:blank";
  let lastHash = "";
  let running = true;
  // Sampling starts once a page has loaded: headless Chrome never resolves a screenshot of the initial blank
  // view, and a hung screenshot blocks every later command on that view.
  let loaded = false;
  // A view runs one evaluate() at a time; goto's probes, waitFor and the script's own evaluate calls take turns.
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T,>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
  // A page that answers an evaluate is a page worth sampling (view.loading is not reliable on every backend).
  const evaluate = (js: string, ms: number, label: string): Promise<unknown> =>
    serial(async () => {
      const result = await within(view.evaluate(js), ms, label);
      loaded = true;
      return result;
    });
  // One screenshot at a time: the periodic sampler and the event-driven samples (after waitFor, at stop) share it.
  let sampling: Promise<void> | null = null;
  const sampleOnce = (): Promise<void> => {
    if (!loaded) return Promise.resolve();
    sampling ??= (async () => {
      try {
        const png = (await within(view.screenshot({ encoding: "buffer" }), 5000, "screenshot")) as Uint8Array;
        const hash = Bun.hash(png).toString(16);
        if (hash !== lastHash) {
          lastHash = hash;
          frames.push({ time: stamp(), png });
        }
      } catch {
        /* view busy or closed */
      } finally {
        sampling = null;
      }
    })();
    return sampling;
  };
  const sampler = (async () => {
    while (running) {
      await sampleOnce();
      await Bun.sleep(loaded ? 1000 / bcfg.fps : 50);
    }
  })();

  /**
   * Navigate and wait for the page to be there. Dev servers may still be starting (connection refused → retry)
   * or take a long first load (Vite pre-bundling, then a reload), so success is judged by the document's
   * readyState at the target URL rather than by the navigate() promise alone.
   */
  const goto = async (rawUrl: string): Promise<void> => {
    const url = normalizeUrl(rawUrl);
    const deadline = performance.now() + config.waitTimeout;
    const target = url.replace(/\/$/, "");
    let navigation: Promise<"ok" | "pending" | "failed"> | null = null;
    for (;;) {
      if (!running) return; // stop() closed the view mid-retry; abort quietly
      try {
        navigation ??= view.navigate(url).then(
        () => "ok" as const,
          (cause: unknown) => (/pending/i.test(String(cause)) ? ("pending" as const) : ("failed" as const)),
        );
      } catch {
        return; // navigate threw synchronously: the view is closed
      }
      const outcome = await Promise.race([navigation, Bun.sleep(750).then(() => "tick" as const)]);
      if (outcome === "ok") {
        currentUrl = url;
        loaded = true;
        return;
      }
      if (outcome === "failed") navigation = null;
      if (!running) return;
      // No evaluate() here: the view's own loading flag and URL say whether the page arrived (some backends keep
      // the navigate() promise pending long after the page is up, and may leave view.url empty).
      const href = (view.url ?? "").replace(/\/$/, "");
      if (outcome === "tick" && (href.startsWith(target) || (!view.loading && href === ""))) {
        currentUrl = url;
        loaded = true;
        return;
      }
      if (performance.now() > deadline) {
        throw new WaitTimeoutError(`browser.goto(${url})`, config.waitTimeout, `current url: ${view.url ?? "(none)"}, loading: ${view.loading}`);
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
        const text = String((await evaluate("document.body ? document.body.innerText : ''", 5000, "waitFor").catch(() => "")) ?? "");
        if (regex.test(text)) {
          loaded = true; // a page that answers is a page worth sampling, even if navigate() has not settled yet
          await sampleOnce(); // the frame the script waited for, captured the moment it appeared
          return;
        }
        if (performance.now() > deadline) throw new WaitTimeoutError(`${regex} in the browser page`, timeout, text.slice(0, 2000));
        await Bun.sleep(150);
      }
    },
    /** Real input emulation first; if the browser's actionability checks stall, a DOM click still drives the page. */
    click: async (selector) => {
      loaded = true;
      try {
        await within(view.click(selector), 3000, "click");
      } catch {
        const hit = await evaluate(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return false; el.click(); return true; })()`, 5000, "click");
        if (hit !== true) throw new Error(`browser.click: no element matches ${selector}`);
      }
    },
    reload: () => within(view.reload(), 30000, "reload").catch((err) => (/pending/i.test(String(err)) ? undefined : Promise.reject(err))),
    evaluate: (js) => evaluate(js, 10000, "evaluate"),
    async stop() {
      // A session shorter than the browser's start-up (cold Chrome on CI) should still show the page once.
      if (frames.length === 0 && initialLoad) await Promise.race([initialLoad, Bun.sleep(5000)]);
      if (!loaded && bcfg.url) await evaluate("document.readyState", 2000, "probe").catch(() => undefined); // marks loaded if the page answers
      running = false;
      await sampler;
      await sampleOnce(); // final state of the page
      try {
        view.close();
      } catch {
        /* closed */
      }
    },
  };

  const initialLoad = bcfg.url ? goto(bcfg.url).catch((err) => log(String(err))) : null;
  return capture;
}
