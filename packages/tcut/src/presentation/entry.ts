import type { PresentationManifest, PresentationTake, TakeCue, TakeDraft } from "./model";
import type { ExportJob } from "./server";
import type { TakeFormat } from "./media";

interface Boot { manifest: PresentationManifest; prefix: string; audience: boolean }
interface PlaybackState { kind: "state"; index: number; time: number; rate: number; sent: number }
type AudienceMessage = PlaybackState | { kind: "ready" | "closed" };
const boot = JSON.parse(document.getElementById("presentation-data")!.textContent!) as Boot;
const { manifest, prefix } = boot;
const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const video = el<HTMLVideoElement>("video");
const advance = el<HTMLButtonElement>("advance");
const scrub = el<HTMLInputElement>("scrub");
const notes = el<HTMLTextAreaElement>("notes");
const recordButton = el<HTMLButtonElement>("record");
const microphone = el<HTMLInputElement>("microphone");
const channel = new BroadcastChannel(`tcut-present-${prefix}`);
const mediaUrl = (file: string) => `${prefix}media/${manifest.id}/${file}`;
const fmt = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;
const fail = (error: Error | string) => { el("error").textContent = error instanceof Error ? error.message : error; el("error").hidden = false; };
const clearError = () => { el("error").hidden = true; };
const handle = (work: () => Promise<void>) => { void work().catch(fail); };
let index = 0;
let ready = false;
let loadingGeneration = 0;
let mediaPlaying = false;
let recording = false;
let saving = false;
let takeStart = 0;
let takeCues: TakeCue[] = [];
let takeTimer = 0;
let recorder: MediaRecorder | undefined;
let microphoneStream: MediaStream | undefined;
let audioChunks: Blob[] = [];
let pendingSave: FormData | undefined;
let notesTimer = 0;
const dirtyNotes = new Map<string, string>();
let audienceWindow: Window | null = null;
let audienceSeen = 0;
let audienceLastMessage: PlaybackState | undefined;
let syncingAudience = false;
let notesPending: Promise<void> = Promise.resolve();

async function request<T>(route: string, body?: { id: string; notes: string } | { format: TakeFormat } | FormData): Promise<T> {
  const options: RequestInit = body === undefined ? {} : body instanceof FormData ? { method: "POST", body } : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) };
  const response = await fetch(prefix + route, options);
  const data = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(data.error ?? `Request failed (${response.status})`);
  return data;
}

const step = () => manifest.steps[index]!;
const lastFrame = () => Math.max(0, step().end - step().start - 1 / manifest.fps);
const sourcePosition = () => Math.max(0, Math.min(manifest.duration - 1 / manifest.fps, step().start + Math.min(video.currentTime || 0, lastFrame())));
const rate = () => ready && mediaPlaying && !video.paused && !video.ended ? video.playbackRate : 0;

function captureCue(): void {
  if (!recording || !ready) return;
  const cue = { at: (performance.now() - takeStart) / 1000, source: sourcePosition(), rate: rate() };
  const previous = takeCues.at(-1);
  if (previous && previous.rate === cue.rate && Math.abs(previous.source + (cue.at - previous.at) * previous.rate - cue.source) < 1 / manifest.fps) return;
  takeCues.push(cue);
}

function broadcast(): void {
  if (boot.audience || !ready) return;
  const state: PlaybackState = { kind: "state", index, time: Math.min(video.currentTime, lastFrame()), rate: rate(), sent: Date.now() };
  channel.postMessage(state);
}

function renderControls(): void {
  const duration = step().end - step().start;
  const finished = video.ended || (ready && video.currentTime >= lastFrame() - 0.001 && !mediaPlaying);
  el("step-count").textContent = `STEP ${String(index + 1).padStart(2, "0")} / ${String(manifest.steps.length).padStart(2, "0")}`;
  el("status").textContent = !ready ? "Loading recorded step…" : mediaPlaying ? "Playing recorded step" : finished ? "Holding · advance when ready" : "Paused · ready when you are";
  el("position").textContent = fmt(Math.min(video.currentTime || 0, duration));
  el("length").textContent = fmt(duration);
  scrub.value = String(duration ? Math.min(1000, (video.currentTime / duration) * 1000) : 0);
  advance.textContent = mediaPlaying ? "Pause" : finished ? index === manifest.steps.length - 1 ? "Replay final step" : "Next step" : video.currentTime > 0 ? "Resume step" : "Play step";
  advance.disabled = !ready;
  el<HTMLButtonElement>("back").disabled = !ready || index === 0;
  el<HTMLButtonElement>("replay").disabled = !ready;
  scrub.disabled = !ready;
  recordButton.disabled = saving || (!ready && !recording && !pendingSave);
}

function waitForMedia(): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => done(new Error("Recorded clip did not load. Keep the tcut server running and try again.")), 15_000);
    const loaded = () => done();
    const error = () => done(new Error(video.error?.message || "This browser could not play the recorded clip"));
    const done = (problem?: Error) => { clearTimeout(timer); video.removeEventListener("loadeddata", loaded); video.removeEventListener("error", error); if (problem) reject(problem); else resolve(); };
    video.addEventListener("loadeddata", loaded, { once: true });
    video.addEventListener("error", error, { once: true });
  });
}

function pause(): void {
  video.pause(); mediaPlaying = false; captureCue(); renderControls(); broadcast();
}

async function play(): Promise<void> {
  if (!ready) return;
  if (video.ended || video.currentTime >= lastFrame()) await seek(0);
  await video.play();
}

async function seek(time: number): Promise<void> {
  if (!ready) return;
  pause();
  const target = Math.max(0, Math.min(lastFrame(), time));
  if (Math.abs(video.currentTime - target) > 0.0001) {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => { video.removeEventListener("seeked", done); reject(new Error("Could not seek the recorded clip")); }, 5000);
      const done = () => { clearTimeout(timer); resolve(); };
      video.addEventListener("seeked", done, { once: true });
      video.currentTime = target;
    });
  }
  captureCue(); renderControls(); broadcast();
}

async function loadStep(target: number, autoplay = false, position = 0): Promise<void> {
  if (target < 0 || target >= manifest.steps.length) return;
  const generation = ++loadingGeneration;
  pause(); ready = false; index = target;
  el("loading").hidden = false;
  video.poster = mediaUrl(step().poster);
  const loaded = waitForMedia();
  video.src = mediaUrl(step().clip); video.load();
  el("step-title").textContent = step().title;
  notes.value = step().notes;
  el("notes-state").textContent = "";
  el("upnext").textContent = manifest.steps[index + 1]?.title ?? "End of walkthrough";
  document.querySelectorAll<HTMLButtonElement>("[data-step]").forEach((button) => {
    if (Number(button.dataset.step) === index) button.setAttribute("aria-current", "step"); else button.removeAttribute("aria-current");
  });
  renderControls();
  try { await loaded; } catch (error) { if (generation === loadingGeneration) throw error; return; }
  if (generation !== loadingGeneration) return;
  ready = true; mediaPlaying = false;
  el("loading").hidden = true;
  if (position) await seek(position);
  else { captureCue(); renderControls(); broadcast(); }
  if (autoplay) await play();
}

async function advanceStep(): Promise<void> {
  if (!ready) return;
  if (mediaPlaying) pause();
  else if (video.ended || video.currentTime >= lastFrame() - 0.001) {
    if (index + 1 < manifest.steps.length) await loadStep(index + 1, true);
    else { await seek(0); await play(); }
  } else await play();
}

video.addEventListener("playing", () => { mediaPlaying = true; captureCue(); renderControls(); broadcast(); });
video.addEventListener("waiting", () => { mediaPlaying = false; captureCue(); renderControls(); broadcast(); });
video.addEventListener("pause", () => { mediaPlaying = false; captureCue(); renderControls(); broadcast(); });
video.addEventListener("ended", () => { mediaPlaying = false; captureCue(); renderControls(); broadcast(); });
video.addEventListener("timeupdate", renderControls);
video.addEventListener("error", () => { if (ready) { mediaPlaying = false; captureCue(); fail(video.error?.message || "Playback failed"); } });

async function savePendingTake(): Promise<void> {
  if (!pendingSave) return;
  saving = true; renderControls(); recordButton.textContent = "Saving take…";
  try {
    await request<PresentationTake>("api/takes", pendingSave);
    pendingSave = undefined;
    recordButton.textContent = "● Start take";
    el("take-clock").textContent = "Take saved";
    el("takes").hidden = false;
    el("toggle-takes").setAttribute("aria-pressed", "true");
    await refreshTakes();
  } finally {
    saving = false;
    if (pendingSave) recordButton.textContent = "Retry saving take";
    renderControls();
  }
}

async function startTake(): Promise<void> {
  if (pendingSave) return savePendingTake();
  if (!ready) return;
  clearError(); saving = true; renderControls();
  try {
    audioChunks = [];
    if (microphone.checked) {
      if (!navigator.mediaDevices?.getUserMedia || !globalThis.MediaRecorder) throw new Error("Microphone recording needs a supported browser on localhost. Chrome or Edge is recommended.");
      microphoneStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: false });
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((type) => MediaRecorder.isTypeSupported(type));
      recorder = new MediaRecorder(microphoneStream, mimeType ? { mimeType } : undefined);
      recorder.addEventListener("dataavailable", (event) => { if (event.data.size) audioChunks.push(event.data); });
      recorder.addEventListener("error", () => fail("Microphone recording encountered an error. Stop this take and check the microphone before trying again."));
      await new Promise<void>((resolve, reject) => {
        recorder!.addEventListener("start", () => resolve(), { once: true });
        recorder!.addEventListener("error", () => reject(new Error("Could not start microphone recording")), { once: true });
        recorder!.start(1000);
      });
    }
    takeStart = performance.now();
    takeCues = [{ at: 0, source: sourcePosition(), rate: rate() }];
    recording = true;
    microphone.disabled = true;
    el<HTMLInputElement>("take-title").disabled = true;
    recordButton.textContent = "■ Stop take";
    recordButton.classList.add("recording");
    takeTimer = window.setInterval(() => {
      const elapsed = (performance.now() - takeStart) / 1000;
      el("take-clock").textContent = `${microphone.checked ? "● Mic on · " : "● "}${fmt(elapsed)}`;
      if (elapsed >= 7200) handle(stopTake);
      else if (ready && rate()) captureCue();
    }, 1000);
    el("take-clock").textContent = "● 0:00";
    el("take-clock").hidden = false;
    el<HTMLDetailsElement>("take-options").open = false;
  } catch (error) {
    microphoneStream?.getTracks().forEach((track) => track.stop()); recorder = undefined; microphoneStream = undefined;
    throw error;
  } finally { saving = false; renderControls(); }
}

async function stopTake(): Promise<void> {
  if (!recording) return;
  const duration = Math.max(1 / manifest.fps, (performance.now() - takeStart) / 1000);
  recording = false; clearInterval(takeTimer); pause();
  el("take-clock").textContent = "Saving take…";
  saving = true; renderControls(); recordButton.classList.remove("recording"); recordButton.textContent = "Saving take…";
  const audioMime = recorder?.mimeType;
  try {
    if (recorder && recorder.state !== "inactive") {
      try {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("Microphone did not finish saving")), 10_000);
        recorder!.addEventListener("stop", () => { clearTimeout(timer); resolve(); }, { once: true });
        recorder!.stop();
      });
      } catch (error) {
        fail(`${error instanceof Error ? error.message : "Microphone recording failed"}. Saving the walkthrough with the audio captured so far.`);
      }
    }
    const draft: TakeDraft = { title: el<HTMLInputElement>("take-title").value.trim() || "Untitled take", duration, cues: takeCues };
    pendingSave = new FormData(); pendingSave.set("take", JSON.stringify(draft));
    if (audioChunks.length && audioMime) {
      const extension = audioMime.includes("mp4") ? "mp4" : audioMime.includes("ogg") ? "ogg" : "webm";
      pendingSave.set("audio", new Blob(audioChunks, { type: audioMime }), `microphone.${extension}`);
    }
    await savePendingTake();
  } finally {
    microphoneStream?.getTracks().forEach((track) => track.stop());
    microphoneStream = undefined; recorder = undefined; saving = false; microphone.disabled = false; el<HTMLInputElement>("take-title").disabled = false; renderControls();
  }
}

async function exportTake(take: PresentationTake, format: TakeFormat, status: HTMLElement): Promise<string> {
  let job = await request<ExportJob>(`api/takes/${take.id}/export`, { format });
  while (job.state === "rendering") {
    status.textContent = `Exporting ${format.toUpperCase()} · ${Math.round(job.progress * 100)}%`;
    await new Promise((resolve) => setTimeout(resolve, 600));
    job = await request<ExportJob>(`api/jobs/${job.id}`);
  }
  if (job.state === "error") throw new Error(job.error || "Export failed");
  status.textContent = `${format.toUpperCase()} ready`;
  return `${prefix}takes/${take.id}/video.${format}`;
}

async function refreshTakes(): Promise<void> {
  const { takes } = await request<{ takes: PresentationTake[] }>("api/takes");
  el("take-count").textContent = String(takes.length);
  el("toggle-takes").textContent = `Takes${takes.length ? ` (${takes.length})` : ""}`;
  el("take-empty").hidden = takes.length > 0;
  if (!recording && !pendingSave) el<HTMLInputElement>("take-title").value = `Take ${takes.length + 1}`;
  const rows = takes.map((take) => {
    const row = document.createElement("div"); row.className = "take-row";
    const info = document.createElement("div"); info.className = "take-info";
    const name = document.createElement("strong"); name.textContent = take.title;
    const detail = document.createElement("small"); detail.textContent = `${fmt(take.duration)} · ${take.audio ? "Microphone recorded" : "Without audio"} · ${new Date(take.createdAt).toLocaleString()}`;
    info.append(name, detail);
    const actions = document.createElement("div"); actions.className = "take-actions";
    const review = document.createElement("button"); review.type = "button"; review.textContent = "Review";
    const format = document.createElement("select"); format.setAttribute("aria-label", `Export format for ${take.title}`);
    for (const value of ["mp4", "webm", "gif"]) { const option = document.createElement("option"); option.value = value; option.textContent = value.toUpperCase(); format.append(option); }
    const exportButton = document.createElement("button"); exportButton.type = "button"; exportButton.textContent = "Export";
    const status = document.createElement("div"); status.className = "export-status"; status.setAttribute("aria-live", "polite");
    const download = document.createElement("a"); download.hidden = true; download.textContent = "Download";
    const run = async (preview: boolean) => {
      review.disabled = true; exportButton.disabled = true; format.disabled = true;
      try {
        const kind = preview ? "mp4" : format.value as TakeFormat;
        const url = await exportTake(take, kind, status);
        download.href = url + "?download"; download.hidden = false; download.textContent = `Download ${kind.toUpperCase()}`;
        if (preview) {
          pause(); el("review-title").textContent = take.title;
          const player = el<HTMLVideoElement>("review-video"); player.src = url;
          el<HTMLDialogElement>("review").showModal(); await player.play();
        }
      } catch (error) { status.textContent = error instanceof Error ? error.message : "Export failed"; }
      finally { review.disabled = false; exportButton.disabled = false; format.disabled = false; }
    };
    review.addEventListener("click", () => handle(() => run(true)));
    exportButton.addEventListener("click", () => handle(() => run(false)));
    actions.append(review, format, exportButton, download); row.append(info, actions, status); return row;
  });
  el("take-list").replaceChildren(...rows);
}

function fullscreen(): void { handle(async () => { if (document.fullscreenElement) await document.exitFullscreen(); else await el("stage").requestFullscreen(); }); }

async function syncAudience(state: PlaybackState): Promise<void> {
  audienceSeen = Date.now(); audienceLastMessage = state;
  if (syncingAudience) return;
  syncingAudience = true;
  try {
    let current: PlaybackState;
    do {
      current = audienceLastMessage!;
      if (index !== current.index || !ready) await loadStep(current.index);
      if (audienceLastMessage !== current) continue;
      const target = Math.min(lastFrame(), Math.max(0, current.time + (current.rate ? (Date.now() - current.sent) / 1000 * current.rate : 0)));
      if ((video.ended && current.rate) || Math.abs(video.currentTime - target) > 0.15) await seek(target);
      if (audienceLastMessage !== current) continue;
      video.playbackRate = current.rate || 1;
      if (current.rate && video.paused) await video.play();
      else if (!current.rate && !video.paused) pause();
    } while (audienceLastMessage !== current);
  } finally { syncingAudience = false; }
}

el("title").textContent = manifest.title;
el("source-status").textContent = `Recorded source · ${manifest.steps.length} steps · ready to replay`;
channel.addEventListener("message", (event: MessageEvent<AudienceMessage>) => {
  if (boot.audience && event.data.kind === "state") handle(() => syncAudience(event.data as PlaybackState));
  if (!boot.audience && event.data.kind === "ready") { el("audience-status").textContent = "Audience connected"; broadcast(); }
  if (!boot.audience && event.data.kind === "closed") el("audience-status").textContent = "Audience disconnected";
});
el("audience-fullscreen").addEventListener("click", fullscreen);

if (boot.audience) {
  channel.postMessage({ kind: "ready" });
  window.addEventListener("beforeunload", () => channel.postMessage({ kind: "closed" }));
  handle(async () => { await loadStep(0); channel.postMessage({ kind: "ready" }); });
  setInterval(() => { if (audienceSeen && Date.now() - audienceSeen > 3000) pause(); }, 1000);
} else {
  const buttons = manifest.steps.map((s, i) => {
    const button = document.createElement("button"); button.type = "button"; button.className = "step-button"; button.dataset.step = String(i);
    const name = document.createElement("span"); name.textContent = `${String(i + 1).padStart(2, "0")}  ${s.title}`;
    button.append(name); button.addEventListener("click", () => handle(() => loadStep(i))); return button;
  });
  el("steps").replaceChildren(...buttons);
  el("toggle-notes").addEventListener("click", () => { el("sidebar").hidden = !el("sidebar").hidden; el("toggle-notes").setAttribute("aria-pressed", String(!el("sidebar").hidden)); });
  el("toggle-takes").addEventListener("click", () => { el("takes").hidden = !el("takes").hidden; el("toggle-takes").setAttribute("aria-pressed", String(!el("takes").hidden)); });
  document.querySelectorAll(".menu button").forEach((button) => button.addEventListener("click", () => { button.closest("details")!.open = false; }));
  el("advance").addEventListener("click", () => handle(advanceStep));
  el("back").addEventListener("click", () => handle(() => loadStep(index - 1)));
  el("replay").addEventListener("click", () => handle(async () => { await seek(0); await play(); }));
  scrub.addEventListener("input", () => handle(() => seek(Number(scrub.value) / 1000 * (step().end - step().start))));
  el<HTMLSelectElement>("speed").addEventListener("change", (event) => { captureCue(); video.playbackRate = Number((event.target as HTMLSelectElement).value); captureCue(); broadcast(); });
  el("focus").addEventListener("click", () => { const focus = document.body.classList.toggle("focus"); el("focus").textContent = focus ? "Back to presenter" : "Audience preview"; el("focus").setAttribute("aria-pressed", String(focus)); });
  el("fullscreen").addEventListener("click", fullscreen);
  el("audience").addEventListener("click", () => { audienceWindow = window.open(prefix + "audience", "tcut-audience", "popup,width=1100,height=750"); if (!audienceWindow) fail("Allow popups for this local page to open the audience window."); else audienceWindow.focus(); });
  notes.addEventListener("input", () => {
    const id = step().id; const text = notes.value; step().notes = text; dirtyNotes.set(id, text); clearTimeout(notesTimer); el("notes-state").textContent = "Saving…";
    notesTimer = window.setTimeout(() => {
      notesPending = notesPending.catch(() => {}).then(async () => {
        for (const [id, text] of dirtyNotes) {
          await request("api/notes", { id, notes: text });
          if (dirtyNotes.get(id) === text) dirtyNotes.delete(id);
          if (step().id === id && !dirtyNotes.has(id)) el("notes-state").textContent = "Saved";
        }
      });
      void notesPending.catch(fail);
    }, 400);
  });
  recordButton.addEventListener("click", () => handle(recording ? stopTake : startTake));
  el("close-review").addEventListener("click", () => el<HTMLDialogElement>("review").close());
  el("review").addEventListener("close", () => el<HTMLVideoElement>("review-video").pause());
  document.addEventListener("keydown", (event) => {
    if ((event.target as HTMLElement).matches("input,textarea,select") || el<HTMLDialogElement>("review").open || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.repeat) return;
    if (event.code === "Space") { event.preventDefault(); handle(advanceStep); }
    else if (event.code === "ArrowRight") { event.preventDefault(); handle(() => loadStep(Math.min(manifest.steps.length - 1, index + 1), true)); }
    else if (event.code === "ArrowLeft") { event.preventDefault(); handle(() => loadStep(Math.max(0, index - 1))); }
    else if (event.code === "KeyR") { event.preventDefault(); handle(async () => { await seek(0); await play(); }); }
    else if (event.code === "KeyF") { event.preventDefault(); fullscreen(); }
  });
  window.addEventListener("beforeunload", (event) => { if (recording || pendingSave || saving || dirtyNotes.size) { event.preventDefault(); event.returnValue = ""; } });
  setInterval(broadcast, 500);
  handle(async () => { await loadStep(0); await refreshTakes(); });
}
