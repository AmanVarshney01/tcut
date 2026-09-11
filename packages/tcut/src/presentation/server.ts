import path from "node:path";
import { presenterAssets } from "./assets";
import { writeJson, type PreparedPresentation } from "./media";
import { presentationPage } from "./page";

export interface PresentationServerOptions { port?: number }
export interface PresentationServer { url: string; close(): Promise<void> }

/** Serve prepared pixels and private notes. Playback has no shell or recording endpoint. */
export async function servePresentation(prepared: PreparedPresentation, opts: PresentationServerOptions = {}): Promise<PresentationServer> {
  const { directory, manifest } = prepared;
  const assets = await presenterAssets();
  const prefix = `/${crypto.randomUUID()}/`;
  let notesWrite = Promise.resolve();
  const server = Bun.serve({
    hostname: "127.0.0.1", port: opts.port ?? 0, maxRequestBodySize: 128 * 1024,
    async fetch(req) {
      const url = new URL(req.url);
      if (!url.pathname.startsWith(prefix)) return new Response("Not found", { status: 404 });
      const route = url.pathname.slice(prefix.length);
      if (req.method !== "GET" && req.method !== "HEAD" && req.headers.get("origin") !== url.origin) return new Response("Origin not allowed", { status: 403 });
      try {
        if (req.method === "GET" || req.method === "HEAD") {
          if (route === "") return new Response(presentationPage(manifest, prefix), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
          if (route === "app.js") return new Response(assets.js, { headers: { "content-type": "text/javascript" } });
          if (route === "app.css") return new Response(assets.css, { headers: { "content-type": "text/css" } });
          const media = /^media\/([a-f0-9]{64})\/(source\.mp4|step-\d+\.(?:mp4|jpg))$/.exec(route);
          if (media && media[1] === manifest.id) {
            const file = Bun.file(path.join(directory, "sources", manifest.id, media[2]!));
            if (await file.exists()) return new Response(file, { headers: { "cache-control": "private, max-age=3600" } });
          }
        } else if (req.method === "POST" && route === "api/notes") {
          const data = await req.json() as { id: string; notes: string };
          const step = manifest.steps.find(s => s.id === data?.id);
          // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate JSON at the HTTP boundary.
          if (!step || typeof data.notes !== "string" || data.notes.length > 20_000) throw new Error("Invalid scene or notes");
          step.notes = data.notes;
          notesWrite = notesWrite.catch(() => {}).then(() => writeJson(path.join(directory, "presentation.json"), manifest));
          await notesWrite;
          return Response.json({ saved: true });
        }
        return new Response("Not found", { status: 404 });
      } catch (error) { return Response.json({ error: error instanceof Error ? error.message : "Request failed" }, { status: 400 }); }
    },
  });
  return { url: `http://127.0.0.1:${server.port}${prefix}`, async close() { await notesWrite.catch(() => {}); await server.stop(true); } };
}
