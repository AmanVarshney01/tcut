## ADDED Requirements

### Requirement: Live recording
`recordLive(config, { command?, cols?, rows? })` SHALL spawn the clean shell (or the given command) in a `Bun.Terminal` sized to the current terminal, mirror PTY output to stdout, forward stdin to the PTY (raw mode when stdin is a TTY), record `o`/`i`/`r` events with timestamps and an `end` marker, and resolve when the process exits. The resulting cast SHALL be renderable by the standard pipeline.

#### Scenario: piped command
- **WHEN** `recordLive` runs `bash -c "echo hi"` with no stdin
- **THEN** the cast contains `hi` as output and ends with the `end` marker

#### Scenario: interactive session
- **WHEN** a user runs `tcut rec` in a terminal and types commands
- **THEN** their keystrokes reach the shell, the screen updates live, and the cast replays the same session
