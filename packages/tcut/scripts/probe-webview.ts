// Diagnostic: how does Bun.WebView behave on this machine? Prints backend, navigation, evaluate and screenshot
// timings for a local page. `bun scripts/probe-webview.ts` (TCUT_DEBUG_CHROME=1 shows Chrome's stderr).
import { createWebView, webViewBackend } from "../src/renderer/view";

const t0 = performance.now();
const at = () => `${((performance.now() - t0) / 1000).toFixed(3)}s`;
const log = (m: string) => console.log(`${at()} ${m}`);
const timed = async <T>(label: string, p: Promise<T>, ms = 8000): Promise<T | undefined> => {
  try {
    const v = await Promise.race([p, Bun.sleep(ms).then(() => Promise.reject(new Error(`timeout ${ms}ms`)))]);
    log(`${label}: ok ${JSON.stringify(v)?.slice(0, 80) ?? ""}`);
    return v;
  } catch (cause) {
    log(`${label}: FAILED ${cause instanceof Error ? cause.message : String(cause)}`);
    return undefined;
  }
};

const server = Bun.serve({ port: 0, hostname: "127.0.0.1", fetch: () => new Response("<html><body><h1 id=t>first</h1><button onclick=\"t.textContent='clicked'\">go</button></body></html>", { headers: { "content-type": "text/html" } }) });
const url = `http://127.0.0.1:${server.port}/`;
log(`platform ${process.platform} backend ${JSON.stringify(webViewBackend())}`);
const view = createWebView({ width: 320, height: 240 });
log(`view created; url=${JSON.stringify(view.url)} loading=${view.loading}`);
const nav = view.navigate(url).then(() => "ok", (cause: unknown) => `rejected: ${cause instanceof Error ? cause.message : String(cause)}`);
for (let i = 0; i < 6; i++) {
  await Bun.sleep(250);
  log(`tick ${i}: url=${JSON.stringify(view.url)} loading=${view.loading}`);
}
await timed("navigate", nav, 5000);
await timed("evaluate readyState", view.evaluate("document.readyState"));
await timed("evaluate innerText", view.evaluate("document.body ? document.body.innerText : ''"));
const shot = await timed("screenshot", view.screenshot({ encoding: "buffer" }));
log(`screenshot bytes: ${shot ? (shot as Uint8Array).length : "none"}`);
await timed("click", view.click("button"), 5000);
await timed("evaluate after click", view.evaluate("document.body.innerText"));
await timed("screenshot 2", view.screenshot({ encoding: "buffer" }));
log(`final url=${JSON.stringify(view.url)} loading=${view.loading}`);
view.close();
server.stop(true);
