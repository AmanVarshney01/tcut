## ADDED Requirements
### Requirement: Hyperlinks in SVG
Cells inside an OSC 8 link SHALL be wrapped in `<a href>` in SVG output.
#### Scenario: printed link
- **WHEN** output contains an OSC 8 link around "docs"
- **THEN** the SVG contains `<a href="…"><tspan …>docs</tspan></a>`
### Requirement: Synchronized output
While a program is inside a mode-2026 block, rendering SHALL hold the previous complete frame, for at most half a second.
#### Scenario: TUI repaint
- **WHEN** a repaint is wrapped in `ESC[?2026h … ESC[?2026l`
- **THEN** no frame shows the partially drawn state
### Requirement: Automatic window title
With `title: "auto"`, the window bar SHALL show the last OSC 0/2 title the program set (per frame in raster and HTML output, the final one in SVG).
#### Scenario: nvim title
- **WHEN** nvim sets the title
- **THEN** the bar shows it
### Requirement: Transcript output
An output ending in `.log` SHALL contain every scrollback line followed by the final screen.
#### Scenario: seq
- **WHEN** `seq 1 60` was recorded on a 12-row grid and rendered to `.log`
- **THEN** the file starts with "1" and ends with "60"
