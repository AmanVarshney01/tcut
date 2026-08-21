## ADDED Requirements
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
