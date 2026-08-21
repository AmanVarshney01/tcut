## ADDED Requirements
### Requirement: Mode-aware input
Cursor keys SHALL be sent in the SS3 form while the program has application cursor mode (DECCKM) on, and `paste()` SHALL wrap text in bracketed-paste markers while the program has bracketed paste on.
#### Scenario: vim arrows
- **WHEN** nvim is running and the script calls `t.down()`
- **THEN** the PTY receives `ESC O B`
### Requirement: Scrollback
`wait`/`expect` SHALL accept `scope: "scrollback"` (scrolled-off lines plus the screen) and `t.scrollback()` SHALL return that transcript.
#### Scenario: long output
- **WHEN** `seq 1 60` scrolled past the grid
- **THEN** `expect(/^3$/m, { scope: "scrollback" })` passes
### Requirement: Caption links
Markdown links in `print()` SHALL be written as OSC 8 hyperlinks.
#### Scenario: docs link
- **WHEN** `print("[docs](https://x)")`
- **THEN** the recording contains an OSC 8 sequence targeting https://x
