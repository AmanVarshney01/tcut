## 1. Grid replay (shared)

- [x] 1.1 `src/export/frames.ts` — replay visible timeline into a headless core, yield de-duplicated grid snapshots with hold durations

## 2. SVG export

- [x] 2.1 `src/export/svg.ts` — frame strip, keyframes, text/rect runs, chrome (padding, margin, radius, bar), cursor
- [x] 2.2 Wire `.svg` into the output dispatcher (no WebView/ffmpeg needed); tests for structure and dedupe

## 3. HTML export

- [x] 3.1 `src/renderer/player-entry.ts` — lite-core player (play/pause/progress/loop/speed)
- [x] 3.2 `src/export/html.ts` — single-file emitter embedding bundle, CSS, theme, events; test for self-containment

## 4. tcut test

- [x] 4.1 Recorder `fast` option (sleep no-op, typing 0)
- [x] 4.2 `src/testing.ts` — discover scripts, run sequentially, summary + exit code; CLI `test` command; test with a passing and a failing script

## 5. Cache

- [x] 5.1 Hash script + record config with `Bun.CryptoHasher`; store `scriptHash`; skip recording on match; `--force`
- [x] 5.2 Tests: hit, miss after edit

## 6. Verify

- [x] 6.1 Demo renders `.svg` and `.html`; `bun test`; typecheck
