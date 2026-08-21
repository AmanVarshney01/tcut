## Why
tcut used a third of what its emulator (wterm/libghostty) exposes. The unused parts map onto things real recordings get wrong: editors see CSI arrows when they asked for SS3, pastes stair-step without bracketed paste, TUIs that use synchronized output show torn frames, links and window titles are lost, scrolled-off output cannot be asserted on, and there is no way to learn why a recording looks wrong.
## What Changes
- Recorder: application-cursor-mode keys (SS3), bracketed `paste()`, `expect/wait` scope `"scrollback"`, `t.scrollback()`, Markdown links in `print()` become OSC 8 links.
- Replay/exporters: OSC 8 links as `<a>` in SVG; synchronized output (mode 2026) holds the previous frame; `title: "auto"` follows OSC titles in raster/HTML/SVG; `.log` transcript output.
- `tcut doctor <cast>`: features used, unsupported protocols (Kitty/Sixel/iTerm2 images), unhandled sequences, warnings; `--json`.
- Examples: ~/dev/test/fidelity/<feature>/ (not in the repo).
## Capabilities
### New Capabilities
- none
### Modified Capabilities
- `script-api`: scope scrollback, scrollback(), paste/keys fidelity, caption links, title auto.
- `video-rendering`: SVG links, sync-output-aware capture, auto title, .log output.
- `cli`: doctor command.
## Impact
keys, screen, recorder, osc (new), doctor (new), frames, svg, render, page/page-entry/webview, html/player-entry, cli, index, tests, docs.
