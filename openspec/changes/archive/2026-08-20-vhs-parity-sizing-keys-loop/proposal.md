## Why
Three VHS conveniences people will look for: sizing the video in pixels, Shift/scroll input, and choosing where a GIF loop starts.
## What Changes
- `width`/`height` (px): video size; `cols`/`rows` are derived from font metrics when not given, and the terminal is centred inside the frame at render time (raster and SVG).
- `t.shift(key)` (Shift+Tab, shifted arrows/home/end/page keys, uppercase letters) and `t.scrollUp(n)` / `t.scrollDown(n)` (SGR mouse wheel; a no-op with a note when the program has no mouse tracking).
- `loopOffset` (frame count or "N%"): GIF/WebP loops start there (frames rotated).
- CLI flags `--width --height --loop-offset`; website refreshed (rec, themes, publish, sizing).
## Capabilities
### New Capabilities
- none
### Modified Capabilities
- `script-api`: shift/scroll helpers; width/height config.
- `video-rendering`: px sizing; loop offset.
## Impact
types/config/keys/recorder/screen/webview/page-entry/svg/encoder/cli, tests, docs, apps/web.
