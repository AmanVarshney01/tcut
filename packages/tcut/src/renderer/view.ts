// One place that knows how to open a headless Bun.WebView on every platform.
// macOS uses the system WebKit; everywhere else Bun drives Chrome/Chromium over the DevTools protocol.

export interface ViewSize {
  width: number;
  height: number;
}

/** Chrome flags that make headless rendering work in containers and CI without changing what is drawn. */
export function chromeArgs(): string[] {
  const args = ["--force-device-scale-factor=1", "--hide-scrollbars", "--disable-dev-shm-usage"];
  // Chrome refuses to start its sandbox as root (Docker, most CI runners); unprivileged users keep it.
  if (process.getuid?.() === 0) args.push("--no-sandbox");
  return args;
}

/** Which backend to use: WebKit on macOS unless TCUT_WEBVIEW=chrome, Chrome elsewhere. */
export function webViewBackend(): Bun.WebView.Backend {
  const forced = process.env.TCUT_WEBVIEW;
  if (process.platform === "darwin" && forced !== "chrome") return "webkit";
  return {
    type: "chrome",
    url: false, // always spawn our own headless Chrome; never attach to a user's running browser
    argv: chromeArgs(),
    stderr: process.env.TCUT_DEBUG_CHROME ? "inherit" : "ignore",
    ...(process.env.BUN_CHROME_PATH && { path: process.env.BUN_CHROME_PATH }),
  };
}

export function createWebView(size: ViewSize): Bun.WebView {
  if (!Bun.WebView) throw new Error("Bun.WebView is not available in this Bun version. tcut needs Bun >= 1.4.");
  try {
    return new Bun.WebView({ ...size, backend: webViewBackend() });
  } catch (cause) {
    const hint =
      process.platform === "darwin"
        ? ""
        : " Rendering pixels on Linux/Windows needs Chrome or Chromium on the PATH (or BUN_CHROME_PATH=/path/to/chrome); SVG, HTML and TXT output need no browser.";
    throw new Error(`Could not start the headless browser: ${cause instanceof Error ? cause.message : String(cause)}.${hint}`, { cause });
  }
}
