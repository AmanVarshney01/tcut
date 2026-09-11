import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineVideo } from "termcut";

// Prepare once, then present: tcut present presentation.video.ts --open
//   tcut presentation.video.ts   → the same script as a video
// Requires Neovim and curl. A real Bun API is written, edited, tested and run in a temporary directory,
// then shown in a browser; everything is captured during preparation and nothing runs while presenting.
const SERVER = `const hits = new Map<string, number[]>();

const routes: Record<string, (req: Request) => Response> = {
  "/": () => Response.json({ ok: true, service: "notes" }),
  "/notes": () => Response.json({ notes: ["ship it", "write the post"] }),
};

Bun.serve({
  port: 3210,
  fetch(req) {
    const path = new URL(req.url).pathname;
    const route = routes[path];
    return route ? route(req) : new Response("not found", { status: 404 });
  },
});
console.log("listening on :3210");
`;

const TEST = `import { expect, test } from "bun:test";

const url = "http://localhost:3210";

test("serves notes", async () => {
  const res = await fetch(url + "/notes");
  expect(res.status).toBe(200);
  expect((await res.json()).notes).toHaveLength(2);
});

test("rate limits after five requests", async () => {
  for (let i = 0; i < 5; i++) await fetch(url + "/");
  expect((await fetch(url + "/")).status).toBe(429);
});
`;

export default defineVideo(
  {
    output: "out/presentation-demo.mp4",
    width: 1280, height: 800, scale: 2, cols: 96, rows: 26, fps: 30,
    theme: "Catppuccin Mocha", title: "notes api", windowBar: "colorful",
    font: { family: "JetBrains Mono", size: 15, lineHeight: 1.35 },
    margin: 24, padding: 20, borderRadius: 12, marginFill: "#0a0a0a",
    cursor: { blink: false }, typingSpeed: "28ms", typingJitter: 0.2, endPause: 0, requires: ["nvim", "curl"],
    browser: { width: 720, height: 460, fps: 10, position: "overlay", offset: { x: 480, y: 260 }, title: "localhost:3210" },
  },
  async (t) => {
    const dir = await mkdtemp(path.join(tmpdir(), "tcut-notes-api-"));
    await Bun.write(path.join(dir, "server.ts"), SERVER);
    await Bun.write(path.join(dir, "server.test.ts"), TEST);
    try {
      await t.hide(async () => {
        await t.run(`cd '${dir}'`);
        // A bare editor: no config, ANSI theme colours, and no auto-indent so typed code lands where the script puts it.
        await t.run(`alias nvim='nvim --clean -n --cmd "filetype indent off" -c "set number nowrap notermguicolors noautoindent nosmartindent"'`);
        await t.run("clear");
      });

      await t.step("The API", async () => {
        await t.slide("Add rate limiting to a Bun API", { subtitle: "Edit, test, run, ship. All prepared, none of it faked.", duration: "2s" });
        await t.run("ls");
        await t.sleep("600ms");
        await t.type("nvim server.ts");
        await t.key("enter");
        await t.wait(/listening on/, { scope: "screen" });
        await t.sleep("1.6s");
      }, { notes: "Two routes, a Map for hits that nothing uses yet. Point at the fetch handler: every request goes through here, so that is where the limit goes." });

      await t.step("The limiter", async () => {
        // Insert the limiter above the routes: jump to line 1, open a line above, type real code.
        await t.type("ggO");
        await t.type("const LIMIT = 5;\n");
        await t.type("const WINDOW = 5_000;\n\n");
        await t.type("function allowed(ip: string): boolean {\n");
        await t.type("  const now = Date.now();\n");
        await t.type("  const recent = (hits.get(ip) ?? []).filter((at) => now - at < WINDOW);\n");
        await t.type("  recent.push(now);\n");
        await t.type("  hits.set(ip, recent);\n");
        await t.type("  return recent.length <= LIMIT;\n");
        await t.type("}\n");
        await t.escape();
        await t.sleep("1.2s");
      }, { notes: "Sliding window, five requests per five seconds per address. Nothing clever: filter the old timestamps, push the new one, compare the length." });

      await t.step("Wire it in", async () => {
        await t.type("/const path\n");
        await t.type("O");
        await t.type('    const ip = req.headers.get("x-forwarded-for") ?? "local";\n');
        await t.type('    if (!allowed(ip)) return new Response("slow down", { status: 429 });');
        await t.escape();
        await t.type(":w\n");
        await t.sleep("1.4s");
        await t.type(":q\n");
        await t.wait();
      }, { notes: "One early return before routing. 429 is the right status. Save, quit, and the file is real on disk." });

      await t.step("Test it", async () => {
        await t.run("bun server.ts </dev/null >/tmp/notes-api.log 2>&1 & sleep 0.5");
        await t.type("nvim server.test.ts");
        await t.key("enter");
        await t.wait(/rate limits/, { scope: "screen" });
        await t.sleep("1.6s");
        await t.type(":q\n");
        await t.wait();
        await t.run("bun test");
        await t.expect(/2 pass/);
        await t.sleep("1.6s");
      }, { notes: "Same runtime, same fetch. The second test hammers the root route until it gets a 429. Two passes; that is the whole suite." });

      await t.step("Watch it happen", async () => {
        await t.run("clear");
        // A fresh client: the tests already spent this window's budget for the local address.
        await t.run(`for i in 1 2 3 4 5 6; do curl -s -o /dev/null -w "%{http_code} " -H "x-forwarded-for: 10.0.0.7" localhost:3210/; done; echo`);
        await t.expect(/200 200 200 200 200 429/);
        await t.sleep("1.4s");
      }, { notes: "Six requests from one address, the sixth gets turned away. Pause here and let the room read the numbers." });

      await t.step("In the browser", async () => {
        await t.browser.goto("http://localhost:3210/notes");
        await t.browser.waitFor(/ship it/);
        await t.focus("browser");
        await t.sleep("1.8s");
        await t.focus("terminal");
        await t.slide("Ship it.", { subtitle: "The script is the demo. Re-run it when the code changes.", duration: "2s", chapter: false });
      }, { notes: "A real browser hitting the real server. Then close: the same script renders the video for the docs." });
    } finally {
      await t.hide(async () => { await t.run("kill %1 2>/dev/null; true"); });
      await rm(dir, { recursive: true, force: true });
    }
  },
);
