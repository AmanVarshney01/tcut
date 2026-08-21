# video-rendering Specification

## Purpose
TBD - created by archiving change tcut-m1-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Rendering is a pure function of cast and config
Rendering SHALL depend only on the `.cast` content and the resolved render config. Frame N SHALL be the screen state at time `N / fps` on the visible timeline, regardless of machine speed.

#### Scenario: re-render is identical
- **WHEN** the same cast is rendered twice with the same config
- **THEN** every emitted PNG frame is byte-identical

### Requirement: Visible timeline
Hidden intervals (`hide`→`show` markers) SHALL be removed from the timeline; events inside them SHALL all be applied at the instant the hide began so the first visible frame after `show` reflects their combined effect. `playbackSpeed` SHALL scale the timeline. Input (`i`) events SHALL be ignored for rendering.

#### Scenario: hidden interval removed
- **WHEN** a cast has 2 s of hidden commands between two visible commands
- **THEN** the rendered video is 2 s shorter and never shows the hidden output

### Requirement: Ghostty-backed DOM rendering in Bun.WebView
Frames SHALL be produced by replaying events into `@wterm/dom` with a `GhosttyCore` inside `Bun.WebView` and calling `screenshot()`. The page bundle SHALL be built with `Bun.build` (ESM) and served from an in-process `Bun.serve` on localhost.

#### Scenario: webview unavailable
- **WHEN** `Bun.WebView` is not a function
- **THEN** rendering fails fast with a message stating the Bun version requirement

### Requirement: Theme and typography
The render config's theme SHALL be applied both as CSS variables (`--term-fg`, `--term-bg`, `--term-cursor`, `--term-color-0..15`) and as OSC 4 / OSC 10 / OSC 11 sequences written to the core before replay, so palette colours resolved by Ghostty match the theme. If the cast contains a full reset (`ESC c`) the palette SHALL be re-applied. Font family, size, line height and letter spacing SHALL come from the config.

#### Scenario: ANSI red uses the theme
- **WHEN** the theme's `red` is `#f38ba8` and the cast prints `ESC[31m`
- **THEN** the rendered glyph colour is `#f38ba8`

### Requirement: Window geometry
Output size SHALL be derived from measured cell size × `cols`/`rows`, plus `padding`, optional window bar, and `margin`, rounded up to even pixels. `borderRadius` and `marginFill` SHALL be honoured; `windowBar` SHALL support `none`, `colorful`, `colorfulRight`, `rings`, `ringsRight` with optional `title`.

#### Scenario: default geometry
- **WHEN** cols=80, rows=24, padding=24, margin=0, no bar
- **THEN** the video is `ceil(80·cellW)+48` by `ceil(24·cellH)+48` pixels (rounded to even)

### Requirement: Deterministic cursor blink
Cursor blink SHALL be driven by the render clock (`cursor.period`, on for the first half), not by CSS animation or wall-clock time, and SHALL be disableable.

#### Scenario: blink off
- **WHEN** `cursor.blink` is false
- **THEN** the cursor is visible in every frame

### Requirement: Encoders and outputs
Outputs SHALL be selected by extension: `.mp4` (libx264, yuv420p, faststart), `.gif` (palette-optimised, ≤50 fps), `.webm` (vp9), `.webp` (animated), and a directory (`…/`) for a PNG sequence. Multiple outputs SHALL be produced from one render pass. ffmpeg SHALL be located on PATH; its absence SHALL produce an actionable error unless only PNG sequences are requested. Each encoder SHALL be covered by an automated test that checks the produced file is non-empty and, for containers, probes as a video stream.

#### Scenario: mp4 and gif together
- **WHEN** `output: ["demo.mp4", "demo.gif"]`
- **THEN** both files are written from a single frame pass

#### Scenario: all encoders
- **WHEN** a short cast is rendered to mp4, webm, gif, webp and a PNG directory
- **THEN** all five outputs exist and are non-empty

### Requirement: Frame reuse
When no drawable event and no blink change occurred since the previous frame, the renderer SHALL reuse the previous PNG instead of taking a new screenshot.

#### Scenario: idle sleep is cheap
- **WHEN** the script sleeps 5 s with blink disabled
- **THEN** at most one screenshot is taken for that interval

### Requirement: Screenshot markers
`screenshot:<path>` markers SHALL write the current frame PNG to `<path>` (creating directories).

#### Scenario: screenshot written
- **WHEN** the timeline crosses a screenshot marker
- **THEN** the PNG at that path equals the frame emitted for that tick

### Requirement: Emulator core selection
The renderer SHALL honour `core: "ghostty"` (default) or `core: "lite"`. With `lite`, the page SHALL use wterm's built-in Zig core and SHALL rely on CSS variables for the palette (no OSC injection).

#### Scenario: lite render
- **WHEN** a cast is rendered with `core: "lite"`
- **THEN** frames are produced and ANSI colours match the theme via CSS variables

### Requirement: Mid-cast resize
An `r` event SHALL resize the terminal grid inside the fixed output frame; the output pixel size SHALL NOT change during a render.

#### Scenario: grow then shrink
- **WHEN** a cast contains `80x24` → `100x30` → `80x24`
- **THEN** every frame has identical dimensions and the content reflows

### Requirement: Theme catalogue
The package SHALL bundle the Ghostty theme collection (≥ 500 themes) plus the built-ins, resolve theme names case- and punctuation-insensitively, keep built-in themes byte-stable (overriding generated collisions), and list/filter them with `tcut themes [query]`. Unknown names SHALL fail with suggestions.
#### Scenario: loose name
- **WHEN** `--theme "Gruvbox Dark"` is passed
- **THEN** the `gruvbox-dark` theme is used
#### Scenario: unknown name
- **WHEN** `--theme catpuccin` is passed
- **THEN** the error lists nearby theme names

### Requirement: Loop offset
`loopOffset` (a frame count or a percentage string) SHALL rotate the frame sequence for looping outputs (GIF, WebP) so playback starts at that frame and the preceding frames play at the end; other outputs are unchanged.
#### Scenario: 50%
- **WHEN** `loopOffset: "50%"` and the render has 100 frames
- **THEN** the GIF's first frame is the original frame 50

### Requirement: Idle compression
When `maxPause` is set, rendering SHALL shorten any gap between consecutive events on the visible timeline to at most `maxPause`, without altering the cast.
#### Scenario: long install
- **WHEN** a cast has a 40 s gap and `maxPause` is 1 s
- **THEN** the video is ~39 s shorter and every event still renders in order

### Requirement: Key overlay
When `keys` is enabled, recent key presses SHALL be shown as chips (printable runs merged, named keys as symbols) for `ttl` after they were pressed.
#### Scenario: ctrl-c
- **WHEN** the cast contains `\x03`
- **THEN** frames within the ttl show a chip reading ⌃C

### Requirement: Zoom
`t.zoom({ rows, cols })` SHALL record a marker; rendering SHALL scale the terminal so that region fills the frame, interpolated over `duration` on the render clock; `t.zoom(null)` resets.
#### Scenario: zoom in and out
- **WHEN** a script zooms to rows 0–5 then resets
- **THEN** frames between the markers are magnified and the final frame is unscaled

### Requirement: Chapters
`t.chapter(name)` markers SHALL be written as chapters into mp4 metadata and listed in `--json` output.
#### Scenario: two chapters
- **WHEN** a script calls chapter twice
- **THEN** `ffprobe -show_chapters` lists both with the right start times

### Requirement: Presets
`preset` SHALL apply a named bundle of defaults (readme, x, youtube, square) under explicit config.
#### Scenario: x preset
- **WHEN** `preset: "x"` is set
- **THEN** the output is 1280×720 at 30 fps unless overridden

