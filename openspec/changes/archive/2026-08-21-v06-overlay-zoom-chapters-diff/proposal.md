## Why
The next set of things people expect from a screen-recording tool, each cheap because tcut renders its own frames from a cast.
## What Changes
- `maxPause` (idle compression) at render time.
- `keys` overlay: recent key presses shown as chips, derived from input events.
- `t.zoom({ rows, cols })` / `t.zoom(null)`: deterministic animated zoom on a screen region.
- `t.chapter(name)`: mp4 chapter metadata + chapters in `--json`.
- `tcut diff a.cast b.cast`: screen-text regression check with optional images.
- `tcut rec --browser <url>` via a shared browser-capture module.
- `preset: readme | x | youtube | square` and `--preset`.
## Capabilities
### New Capabilities
- none
### Modified Capabilities
- `video-rendering`: maxPause, keys, zoom, chapters, presets.
- `cli`: diff, --browser, --preset, --max-pause, --keys.
## Impact
timeline, config, types, recorder, live, renderer page/webview, encoder, cli, tests, docs.
