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
Outputs SHALL be selected by extension: `.mp4` (libx264, yuv420p, faststart), `.gif` (palette-optimised, ≤50 fps), `.webm` (vp9), `.webp` (animated), and a directory (`…/`) for a PNG sequence. Multiple outputs SHALL be produced from one render pass. ffmpeg SHALL be located on PATH; its absence SHALL produce an actionable error unless only PNG sequences are requested.

#### Scenario: mp4 and gif together
- **WHEN** `output: ["demo.mp4", "demo.gif"]`
- **THEN** both files are written from a single frame pass

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

