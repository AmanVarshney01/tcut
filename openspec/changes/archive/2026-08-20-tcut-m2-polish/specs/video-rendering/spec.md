## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Encoders and outputs
Outputs SHALL be selected by extension: `.mp4` (libx264, yuv420p, faststart), `.gif` (palette-optimised, ≤50 fps), `.webm` (vp9), `.webp` (animated), and a directory (`…/`) for a PNG sequence. Multiple outputs SHALL be produced from one render pass. ffmpeg SHALL be located on PATH; its absence SHALL produce an actionable error unless only PNG sequences are requested. Each encoder SHALL be covered by an automated test that checks the produced file is non-empty and, for containers, probes as a video stream.

#### Scenario: mp4 and gif together
- **WHEN** `output: ["demo.mp4", "demo.gif"]`
- **THEN** both files are written from a single frame pass

#### Scenario: all encoders
- **WHEN** a short cast is rendered to mp4, webm, gif, webp and a PNG directory
- **THEN** all five outputs exist and are non-empty
