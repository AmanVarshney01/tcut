## Why
Compared with VHS, t-rec, terminalizer, Freeze and svg-term, tcut lacked presentation polish (shadow, transparency, watermark) and any way to edit a recording (trim, join, per-segment speed). Each fits an existing layer: looks belong to the page compositor (so SVG/HTML get them too), edits belong to the cast (so every output format and `tcut test`/`diff` keep working), and ffmpeg stays an encoder.
## What Changes
- `shadow`, `watermark`, `marginFill: "transparent"` (two-background matting; WebM/GIF/WebP/PNG/SVG/HTML carry alpha, MP4/JPEG fall back).
- `.txt` output: the final screen as text.
- `tcut cut` / `render --from --to`, `--chapters`, `--split-chapters`, `tcut concat`, `t.timelapse(fn, { speed })` — all on the visible timeline.
- Fix: `applyOverrides` converted `maxPause` seconds as milliseconds, squashing gaps on `render --theme`.
## Capabilities
### New Capabilities
- none
### Modified Capabilities
- `video-rendering`: shadow, watermark, transparency, txt, clip selection, timelapse segments.
- `cli`: cut, concat, --from/--to/--chapters/--split-chapters, --shadow, --watermark(-image), --gap.
- `script-api`: `t.timelapse`, `shadow`/`watermark`/`marginFill: "transparent"` config.
## Impact
types, config, cast, timeline, edit (new), recorder, renderer page/page-entry/webview/encoder/png (new), export svg/html/frames, render, video, cli, index, tests, docs, website.
