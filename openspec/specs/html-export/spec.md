# html-export Specification

## Purpose
TBD - created by archiving change tcut-m3-exporters-and-test. Update Purpose after archive.
## Requirements
### Requirement: Self-contained HTML player
A `.html` output SHALL be a single file embedding the cast events (visible timeline), the theme as CSS variables, wterm's lite core + DOM renderer bundle, and a small player that replays events on their timestamps with play/pause and loop. It SHALL work when opened from `file://`.

#### Scenario: html output
- **WHEN** `output: "demo.html"` is rendered
- **THEN** the file contains no external `<script src>`/`<link href>` references and includes the serialized events

### Requirement: Player controls
The player SHALL expose play/pause, a progress bar, and a loop toggle (default on), and SHALL apply `playbackSpeed`.

#### Scenario: loop
- **WHEN** playback reaches the end with loop enabled
- **THEN** the terminal is reset and playback restarts

