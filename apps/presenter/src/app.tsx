import { useEffect, useRef, useState } from "react";
import type { PresentationManifest } from "../../../packages/tcut/src/presentation/model";

const time = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(Math.max(0, seconds) % 60)).padStart(2, "0")}`;

const SHORTCUTS: Array<[string, string]> = [
  ["Space", "Play, pause, or advance after a hold"],
  ["← / →", "Previous / next scene"],
  ["R", "Replay this scene"],
  ["F", "Fullscreen stage"],
  ["N", "Notes"],
  ["Home / End", "First / last scene"],
  ["?", "This sheet"],
];

/** Prepared scenes, played at the presenter's pace. Video, webcam and voice are the screen recorder's job. */
export function Presenter({ manifest, prefix }: { manifest: PresentationManifest; prefix: string }) {
  // Two stacked players: the next scene loads into the one underneath and is raised only once it has a decoded
  // frame, so the visible frame never blanks between scenes. Clips are cut from one recording, so the hold
  // frame of one scene and the first frame of the next are the same pixels.
  const players = [useRef<HTMLVideoElement>(null), useRef<HTMLVideoElement>(null)] as const;
  const activeRef = useRef(0);
  const [active, setActive] = useState(0);
  const pendingPlay = useRef(false);
  const stage = useRef<HTMLDivElement>(null);
  const generation = useRef(0);
  const activeScene = useRef<HTMLButtonElement>(null);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [notesOpen, setNotesOpen] = useState(true);
  const [notes, setNotes] = useState(manifest.steps.map((s) => s.notes));
  const [notesStatus, setNotesStatus] = useState("");
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [shownOnce, setShownOnce] = useState(false);
  const [error, setError] = useState("");
  const [help, setHelp] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const noteTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const dirty = useRef(new Map<string, string>());
  const noteWrites = useRef(Promise.resolve());

  const scene = manifest.steps[index]!;
  const length = scene.end - scene.start;
  const lastFrame = Math.max(0, length - 1 / manifest.fps);
  const shown = Math.min(position, length);
  const finished = ready && !playing && position >= lastFrame - 0.001;
  const last = index === manifest.steps.length - 1;
  const next = manifest.steps[index + 1];

  const fail = (problem: Error | string) => setError(problem instanceof Error ? problem.message : problem);
  const run = (work: () => Promise<void>) => {
    void work().catch(fail);
  };
  const source = (file: string) => `${prefix}media/${manifest.id}/${file}`;

  const front = () => players[activeRef.current as 0 | 1].current!;
  const back = () => players[(1 - activeRef.current) as 0 | 1].current!;
  const loaded = (player: HTMLVideoElement, step: PresentationManifest["steps"][number]) =>
    player.dataset.step === step.id && player.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA;
  const prime = (player: HTMLVideoElement, step: PresentationManifest["steps"][number]) => {
    if (player.dataset.step === step.id && player.readyState >= HTMLMediaElement.HAVE_METADATA) return;
    player.pause();
    player.dataset.step = step.id;
    player.src = source(step.clip);
    player.load();
  };
  const preloadNext = (from: number) => {
    const step = manifest.steps[from + 1];
    if (step) prime(back(), step);
  };
  const cue = (target: number, autoplay = false) => {
    if (target < 0 || target >= manifest.steps.length) return;
    const step = manifest.steps[target]!;
    const current = ++generation.current;
    pendingPlay.current = autoplay;
    front().pause();
    setPlaying(false);
    setReady(false);
    setPosition(0);
    setIndex(target);
    setError("");
    setLoadAttempt((v) => v + 1);
    const show = () => {
      if (current !== generation.current) return;
      const previous = front();
      const next = back();
      previous.pause();
      if (next.currentTime > 0) next.currentTime = 0;
      next.playbackRate = next.defaultPlaybackRate = speed;
      activeRef.current = 1 - activeRef.current;
      setActive(activeRef.current);
      setPlaying(false);
      setReady(true);
      setShownOnce(true);
      if (pendingPlay.current) {
        pendingPlay.current = false;
        run(async () => next.play());
      }
      // The old player stays underneath until the new one has painted; only then is it reused for the next clip.
      setTimeout(() => {
        if (current === generation.current) preloadNext(target);
      }, 250);
    };
    const next = back();
    if (loaded(next, step)) {
      show();
      return;
    }
    next.onloadeddata = () => {
      next.onloadeddata = null;
      show();
    };
    prime(next, step);
  };
  const play = async () => {
    if (!ready) {
      pendingPlay.current = true;
      return;
    }
    const player = front();
    if (player.ended || player.currentTime >= lastFrame) player.currentTime = 0;
    await player.play();
  };
  const advance = async () => {
    if (!ready) {
      pendingPlay.current = true;
      return;
    }
    if (playing) front().pause();
    else if (finished && !last) cue(index + 1, true);
    else await play();
  };
  const replay = async () => {
    if (!ready) return;
    front().currentTime = 0;
    await front().play();
  };
  const toggleFullscreen = async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      setHelp(false);
      await stage.current!.requestFullscreen();
    }
  };
  const reveal = () => {
    setControlsVisible(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setControlsVisible(false), 1800);
  };
  const saveNotes = () => {
    noteWrites.current = noteWrites.current
      .catch(() => {})
      .then(async () => {
        for (const [id, text] of dirty.current) {
          const result = await fetch(prefix + "api/notes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, notes: text }) });
          if (!result.ok) throw new Error("Could not save notes. Keep the server running and try again.");
          if (dirty.current.get(id) === text) dirty.current.delete(id);
        }
        setNotesStatus("Saved");
      });
    void noteWrites.current.catch((problem: Error) => {
      setNotesStatus("Not saved · edit to retry");
      fail(problem);
    });
  };

  useEffect(() => {
    cue(0);
    const changed = () => {
      setFullscreen(!!document.fullscreenElement);
      reveal();
    };
    const unload = (event: BeforeUnloadEvent) => {
      if (dirty.current.size) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    document.addEventListener("fullscreenchange", changed);
    window.addEventListener("beforeunload", unload);
    return () => {
      ++generation.current;
      clearTimeout(hideTimer.current);
      clearTimeout(noteTimer.current);
      document.removeEventListener("fullscreenchange", changed);
      window.removeEventListener("beforeunload", unload);
      if (dirty.current.size) saveNotes();
    };
  }, []);
  useEffect(() => {
    activeScene.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [index]);
  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setError("Scene did not load. Keep the server running, then select a scene to retry."), 15000);
    return () => clearTimeout(timer);
  }, [ready, index, loadAttempt]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (target?.matches?.("input,textarea,select") || event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "?") {
        event.preventDefault();
        setHelp((v) => !v);
        return;
      }
      const actions = new Map<string, () => void>([
        ["Space", () => run(advance)],
        ["ArrowRight", () => cue(index + 1, true)],
        ["ArrowLeft", () => cue(index - 1)],
        ["KeyR", () => run(replay)],
        ["KeyF", () => run(toggleFullscreen)],
        ["KeyN", () => setNotesOpen((v) => !v)],
        ["Home", () => cue(0)],
        ["End", () => cue(manifest.steps.length - 1)],
        ["Escape", () => setHelp(false)],
      ]);
      const action = actions.get(event.code);
      if (action) {
        event.preventDefault();
        action();
      }
    };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  });

  const status = !ready ? (shownOnce ? "" : "Loading…") : playing ? "Playing" : finished ? (last ? "End · holding" : "Holding · Space for next") : position > 0 ? "Paused" : "Ready";
  const action = playing ? "Pause" : finished ? (last ? "Replay" : "Next scene") : position > 0 ? "Resume" : "Play scene";

  return (
    <div className={`presenter${notesOpen ? " with-notes" : ""}`}>
      <header>
        <div className="brand">tcut</div>
        <div className="file">{manifest.title}</div>
        <div className="header-actions">
          <button aria-pressed={notesOpen} title="Speaker notes (N)" onClick={() => setNotesOpen((v) => !v)}>
            Notes
          </button>
          <button title="Fullscreen stage (F)" onClick={() => run(toggleFullscreen)}>
            Fullscreen
          </button>
          <button aria-pressed={help} title="Keyboard shortcuts (?)" onClick={() => setHelp((v) => !v)}>
            ?
          </button>
        </div>
      </header>
      {error && (
        <div className="error" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError("")}>
            Dismiss
          </button>
        </div>
      )}
      <div className="workspace">
        <main className="stage-column">
          <div className="stage-status">
            <span className="count">
              {String(index + 1).padStart(2, "0")}
              <span className="of"> / {String(manifest.steps.length).padStart(2, "0")}</span>
            </span>
            <span className="scene-title">{scene.title}</span>
            <span id="status" aria-live="polite">
              {status}
            </span>
          </div>
          <div
            ref={stage}
            className={`stage${fullscreen ? " fullscreen" : ""}${controlsVisible ? " controls-visible" : ""}`}
            onPointerMove={reveal}
            onPointerLeave={() => {
              if (fullscreen) setControlsVisible(false);
            }}
          >
            {players.map((ref, slot) => (
              <video
                key={slot}
                ref={ref}
                id={slot === active ? "video" : undefined}
                className={slot === active ? "front" : "back"}
                playsInline
                muted
                preload="auto"
                onPlaying={() => slot === activeRef.current && setPlaying(true)}
                onPause={() => slot === activeRef.current && setPlaying(false)}
                onEnded={() => slot === activeRef.current && setPlaying(false)}
                onWaiting={() => slot === activeRef.current && setPlaying(false)}
                onTimeUpdate={(e) => slot === activeRef.current && setPosition(e.currentTarget.currentTime)}
                onError={() => {
                  if (ref.current!.dataset.step !== scene.id) return;
                  fail("This scene could not play. Select it again to retry.");
                }}
              />
            ))}
            {!shownOnce && <div className="loading">Loading scene…</div>}
            {fullscreen && (
              <div className="fs-transport" inert={!controlsVisible}>
                <button disabled={index === 0} onClick={() => cue(index - 1)}>
                  Back
                </button>
                <button className="primary" onClick={() => run(advance)}>
                  {action}
                </button>
                <button disabled={last} onClick={() => cue(index + 1, true)}>
                  Next
                </button>
                <span className="fs-clock">
                  {time(shown)} / {time(length)}
                </span>
                <button onClick={() => run(toggleFullscreen)}>Exit</button>
              </div>
            )}
          </div>
          <div className="scrub">
            <span>{time(shown)}</span>
            <input
              aria-label="Seek within the scene"
              type="range"
              min={0}
              max={1000}
              disabled={!ready}
              value={Math.min(1000, (shown / Math.max(length, 1e-6)) * 1000)}
              onChange={(e) => {
                front().pause();
                front().currentTime = Math.min(lastFrame, (Number(e.target.value) / 1000) * length);
              }}
            />
            <span>{time(length)}</span>
          </div>
          <div className="transport">
            <button id="back" title="Previous scene (←)" disabled={index === 0} onClick={() => cue(index - 1)}>
              Back
            </button>
            <button title="Replay this scene (R)" onClick={() => run(replay)}>
              Replay
            </button>
            <button id="advance" className="primary" title="Space" onClick={() => run(advance)}>
              {action}
            </button>
            <button id="next" title="Next scene (→)" disabled={last} onClick={() => cue(index + 1, true)}>
              Next
            </button>
            <select
              className="speed"
              aria-label="Playback speed"
              disabled={!ready}
              value={speed}
              onChange={(e) => {
                const value = Number(e.target.value);
                setSpeed(value);
                for (const ref of players) ref.current!.playbackRate = ref.current!.defaultPlaybackRate = value;
                e.target.blur();
              }}
            >
              {[0.5, 1, 1.5, 2].map((v) => (
                <option key={v} value={v}>
                  {v}×
                </option>
              ))}
            </select>
          </div>
          <nav className="steps" aria-label="Scenes">
            {manifest.steps.map((s, i) => (
              <button
                key={s.id}
                ref={i === index ? activeScene : undefined}
                className="step-button"
                aria-current={i === index ? "step" : undefined}
                title={s.title}
                onClick={() => cue(i)}
              >
                <span className="step-index">{String(i + 1).padStart(2, "0")}</span>
                <span className="step-name">{s.title}</span>
              </button>
            ))}
          </nav>
        </main>

        {notesOpen && (
          <aside className="inspector" aria-label="Speaker notes">
            <section className="notes-panel">
              <h1>{scene.title}</h1>
              <textarea
                id="notes"
                aria-label="Speaker notes"
                value={notes[index]}
                placeholder="Notes for this scene. Only you see them."
                spellCheck
                onChange={(e) => {
                  const text = e.target.value;
                  setNotes((values) => values.map((v, i) => (i === index ? text : v)));
                  dirty.current.set(scene.id, text);
                  setNotesStatus("Saving…");
                  clearTimeout(noteTimer.current);
                  noteTimer.current = setTimeout(saveNotes, 400);
                }}
              />
              <div className="notes-foot">
                <span className="notes-state" aria-live="polite">
                  {notesStatus}
                </span>
              </div>
              <div className="upnext">
                <span className="label">Up next</span>
                {next ? (
                  <>
                    <span className="upnext-title">{next.title}</span>
                    {notes[index + 1] && <span className="upnext-note">{notes[index + 1]!.split("\n")[0]}</span>}
                  </>
                ) : (
                  <span className="upnext-title muted">Last scene</span>
                )}
              </div>
            </section>
          </aside>
        )}
      </div>

      {help && (
        <div className="sheet-backdrop" onClick={() => setHelp(false)} role="presentation">
          <div className="sheet" role="dialog" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
            <h2>Keyboard</h2>
            <dl>
              {SHORTCUTS.map(([key, what]) => (
                <div key={key}>
                  <dt>
                    <kbd>{key}</kbd>
                  </dt>
                  <dd>{what}</dd>
                </div>
              ))}
            </dl>
            <p className="sheet-note">Scenes are prepared footage; nothing runs here. Use your screen recorder for video, camera and voice.</p>
          </div>
        </div>
      )}
    </div>
  );
}
