## Design

The recorder executes named `t.step()` callbacks once and emits start/end markers plus chapter markers. The existing timeline transforms hidden intervals, speed and idle compression before presentation boundaries are aligned to video frames. Explicit steps exclude setup outside their callbacks; chapter-only and unmarked casts remain usable.

Preparation renders the complete source with the existing WebView renderer, preserving terminal, browser, caption, slide and overlay behavior. ffmpeg creates independent MP4 clips and posters so playback cannot drift into the next step. A content fingerprint covers the cast, resolved config and external visual assets. Each revision lives in its own source directory; takes reference that revision even after a script changes.

The local Bun server serves a full-width minimal page and a separate audience page. It binds to loopback, uses a random session URL, confines media routes and checks Origin on writes. A same-origin BroadcastChannel synchronizes the audience window. Notes, settings and take history are collapsed by default. Native video playback provides pause, seek, replay and speed without executing commands. Playback generations discard stale clip loads.

Take cues record wall time, source position and playback rate; rate zero means hold. Optional MediaRecorder audio shares the take clock. Cumulative frame quantization avoids per-cue duration drift. Export trims or freezes source frames for each segment, concatenates them and combines microphone audio for MP4/WebM. GIF is silent. Take metadata and assets are local; failed browser saves retain the draft for retry, and export jobs expose progress/errors. Completed exports are reused.

Notes are serialized and saved atomically. Pending edits are tracked per step so switching steps during debounce cannot discard another step's edit. The page warns before leaving an active/unsaved take or pending notes.

## Boundaries

The audience window runs in the same browser on the same computer. Remote delivery is through the user's screen-sharing app. Microphone narration is recorded separately; original application audio and automatic transcription are outside this implementation. Recorded captions freeze with the pixels when paused. Source rendering requires the existing renderer and ffmpeg; browser capture needs MediaRecorder support. All changes remain local and the package version stays 1.4.0.

## Verification

Unit and integration tests cover boundaries, callback returns, invalid nesting, cache reuse, persisted notes/takes, origin and path restrictions, byte ranges, multipart audio and exact exported frame/color/audio timing. A CLI counter fixture verifies repeated preparation never reruns the script. Browser checks exercise playback, keyboard pacing, microphone capture with a synthetic tone, review/export, notes, audience synchronization and responsive layout.
