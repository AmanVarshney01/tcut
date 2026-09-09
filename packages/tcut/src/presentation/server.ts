import { mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { pageAssets } from "../renderer/bundle";
import { exportPresentationTake, writeJson, type PreparedPresentation, type TakeFormat } from "./media";
import { validateTake, type PresentationTake, type TakeDraft } from "./model";
import { presentationPage } from "./page";

export interface PresentationServerOptions { port?: number }
export interface PresentationServer { url: string; close(): Promise<void> }
export interface ExportJob { id: string; takeId: string; format: TakeFormat; state: "rendering" | "done" | "error"; progress: number; error?: string }
type ApiResponse = PresentationTake | ExportJob | { takes: PresentationTake[] } | { saved: boolean } | { error: string };
const UUID = /^[a-f0-9-]{36}$/;

/** Serve only one local presentation, behind an unguessable session path. */
export async function servePresentation(prepared: PreparedPresentation, opts: PresentationServerOptions = {}): Promise<PresentationServer> {
  const { directory, manifest } = prepared;
  const assets = await pageAssets();
  const prefix = `/${crypto.randomUUID()}/`;
  const takesDir = path.join(directory, "takes");
  await mkdir(takesDir, { recursive: true });
  const jobs = new Map<string, ExportJob>();
  const pending = new Set<Promise<void>>();
  const abort = new AbortController();
  let notesWrite = Promise.resolve();
  const json = (data: ApiResponse, status = 200) => Response.json(data, { status, headers: { "cache-control": "no-store" } });
  const takeFile = (id: string) => {
    if (!UUID.test(id)) throw new Error("Invalid take id");
    return path.join(takesDir, id, "take.json");
  };
  const server = Bun.serve({
    hostname: "127.0.0.1", port: opts.port ?? 0, maxRequestBodySize: 512 * 1024 * 1024,
    async fetch(req) {
      const url = new URL(req.url);
      if (!url.pathname.startsWith(prefix)) return new Response("Not found", { status: 404 });
      const route = url.pathname.slice(prefix.length);
      if (req.method !== "GET" && req.method !== "HEAD" && req.headers.get("origin") !== url.origin) return new Response("Origin not allowed", { status: 403 });
      try {
        if (req.method === "GET" || req.method === "HEAD") {
          if (route === "" || route === "audience") return new Response(presentationPage(manifest, prefix, route === "audience"), { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "referrer-policy": "no-referrer" } });
          if (route === "app.js") return new Response(assets.presenterJs, { headers: { "content-type": "text/javascript" } });
          if (route === "api/takes") {
            const takes: PresentationTake[] = [];
            for (const name of await readdir(takesDir)) {
              if (UUID.test(name) && await Bun.file(takeFile(name)).exists()) takes.push(await Bun.file(takeFile(name)).json() as PresentationTake);
            }
            return json({ takes: takes.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
          }
          if (route.startsWith("api/jobs/")) {
            const job = jobs.get(route.slice(9));
            return job ? json(job) : json({ error: "Export job not found" }, 404);
          }
          const media = /^media\/([a-f0-9]{64})\/(source\.mp4|step-\d+\.(?:mp4|jpg))$/.exec(route);
          const output = /^takes\/([a-f0-9-]{36})\/video\.(mp4|webm|gif)$/.exec(route);
          const file = media ? path.join(directory, "sources", media[1]!, media[2]!) : output ? path.join(takesDir, output[1]!, `video.${output[2]}`) : null;
          if (file && await Bun.file(file).exists()) {
            const headers = new Headers({ "cache-control": "private, max-age=3600" });
            if (url.searchParams.has("download")) headers.set("content-disposition", `attachment; filename="tcut-take.${output?.[2] ?? "mp4"}"`);
            return new Response(Bun.file(file), { headers });
          }
          return json({ error: "Not found" }, 404);
        }
        if (req.method === "POST" && route === "api/notes") {
          const data = await req.json() as { id: string; notes: string };
          const step = manifest.steps.find((s) => s.id === data.id);
          // oxlint-disable-next-line anti-slop/no-runtime-typeof -- Validate untrusted HTTP JSON before persisting it.
          if (!step || typeof data.notes !== "string" || data.notes.length > 20_000) throw new Error("Invalid step or notes");
          step.notes = data.notes;
          notesWrite = notesWrite.catch(() => {}).then(() => writeJson(path.join(directory, "presentation.json"), manifest));
          await notesWrite;
          return json({ saved: true });
        }
        if (req.method === "POST" && route === "api/takes") {
          const form = await req.formData();
          const field = form.get("take");
          if (!field || field instanceof Blob) throw new Error("Missing take data");
          const draft = JSON.parse(field) as TakeDraft;
          validateTake(draft, manifest);
          const take: PresentationTake = { version: 1, id: crypto.randomUUID(), presentationId: manifest.id, title: draft.title.trim(), createdAt: new Date().toISOString(), duration: draft.duration, cues: draft.cues };
          const dir = path.join(takesDir, take.id);
          await mkdir(dir, { recursive: true });
          try {
            const audio = form.get("audio");
            if (audio instanceof Blob && audio.size) {
              const types = new Map([["audio/webm", "webm"], ["video/webm", "webm"], ["audio/ogg", "ogg"], ["audio/mp4", "mp4"], ["video/mp4", "mp4"]]);
              const ext = types.get(audio.type.split(";")[0]!);
              if (!ext) throw new Error("Microphone recording must be WebM, Ogg or MP4 audio");
              take.audio = `microphone.${ext}`;
              await Bun.write(path.join(dir, take.audio), audio);
            }
            await writeJson(takeFile(take.id), take);
          } catch (error) { await rm(dir, { recursive: true, force: true }); throw error; }
          return json(take, 201);
        }
        const exportMatch = /^api\/takes\/([a-f0-9-]{36})\/export$/.exec(route);
        if (req.method === "POST" && exportMatch) {
          const id = exportMatch[1]!;
          const { format = "mp4" } = await req.json() as { format?: TakeFormat };
          if (!["mp4", "webm", "gif"].includes(format)) throw new Error("Unknown export format");
          const duplicate = [...jobs.values()].find((job) => job.takeId === id && job.format === format && job.state === "rendering");
          if (duplicate) return json(duplicate, 202);
          const take = await Bun.file(takeFile(id)).json() as PresentationTake;
          const job: ExportJob = { id: crypto.randomUUID(), takeId: id, format, state: "rendering", progress: 0 };
          jobs.set(job.id, job);
          if (await Bun.file(path.join(takesDir, id, `video.${format}`)).exists()) { job.state = "done"; job.progress = 1; return json(job); }
          const task = exportPresentationTake(directory, take, { format, signal: abort.signal, onProgress: (progress) => { job.progress = progress; } })
            .then(() => { job.state = "done"; job.progress = 1; })
            .catch((error: Error) => { job.state = "error"; job.error = error.message; })
            .finally(() => { pending.delete(task); });
          pending.add(task);
          return json(job, 202);
        }
        return json({ error: "Not found" }, 404);
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : "Invalid request" }, 400);
      }
    },
  });
  return { url: `${server.url.origin}${prefix}`, async close() { abort.abort(); await Promise.allSettled([...pending, notesWrite]); await server.stop(true); } };
}
