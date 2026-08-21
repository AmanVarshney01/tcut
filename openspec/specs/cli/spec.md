# cli Specification

## Purpose
TBD - created by archiving change tcut-m1-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Commands
The `tcut` binary SHALL provide: `tcut <script.ts>` (record + render), `tcut record <script.ts>`, `tcut render <file.cast>`, `tcut test <path…>`, `tcut init [name]`, `tcut themes`, and `-h/--help`. `--force` SHALL bypass the cast cache.

#### Scenario: run a script
- **WHEN** `tcut examples/demo.ts` is executed
- **THEN** the cast and every configured output are written and their paths printed

#### Scenario: render an existing cast
- **WHEN** `tcut render demo.cast --theme dracula -o demo.gif` is executed
- **THEN** a GIF is produced from the cast with the Dracula theme without re-running the shell

#### Scenario: test command
- **WHEN** `tcut test examples/` is executed
- **THEN** each script is run in fast mode and a summary with exit status is produced

### Requirement: Overrides
Flags `-o/--output` (repeatable), `--theme`, `--font`, `--font-size`, `--line-height`, `--letter-spacing`, `--fps`, `--speed`, `--padding`, `--margin`, `--margin-fill`, `--radius`, `--window-bar`, `--title`, `--no-blink`, `--core`, `--cast`, `-q/--quiet` SHALL override the script's config without modifying the script. `--record-only` SHALL stop after writing the cast.

#### Scenario: theme override
- **WHEN** a script specifies `theme: "catppuccin-mocha"` and `--theme dracula` is passed
- **THEN** the output uses Dracula colours

#### Scenario: record only
- **WHEN** `tcut demo.ts --record-only` is run
- **THEN** the cast is written and no video outputs are produced

### Requirement: Progress and errors
The CLI SHALL print recording/rendering progress to stderr (suppressed with `--quiet`), SHALL exit non-zero on any error, and SHALL include the screen dump for wait/expect failures.

#### Scenario: expect failure exit code
- **WHEN** a script's `expect()` fails
- **THEN** the process exits with code 1 and prints the screen

### Requirement: init scaffold
`tcut init [name]` SHALL create `<name>.video.ts` with a working example and SHALL refuse to overwrite an existing file.

#### Scenario: scaffold
- **WHEN** `tcut init demo` runs in an empty directory
- **THEN** `demo.video.ts` exists and `tcut demo.video.ts` succeeds

### Requirement: rec command
`tcut rec [options] [-- command…]` SHALL record a live session (the clean shell by default, or `command`), write the cast, and render to `-o` outputs (default `rec.mp4`) unless `--record-only`. Render option flags SHALL apply.

#### Scenario: rec with command
- **WHEN** `tcut rec --cast s.cast -o s.svg -- bash -c "echo x"` runs
- **THEN** `s.cast` contains `x` and `s.svg` is written

### Requirement: JSON output
With `--json` every command SHALL print exactly one JSON document on stdout (results, or `{ "error", "type" }` on failure with exit code 1) and no status lines.
#### Scenario: render
- **WHEN** `tcut render x.cast -o y.svg --json` succeeds
- **THEN** stdout is a JSON object with `outputs[].path/bytes`, `frames`, `durationSeconds`

### Requirement: diff command
`tcut diff a.cast b.cast [--at t] [--images dir]` SHALL compare the rendered screen text of both casts at the end (or at `--at`), print a unified diff, exit 1 on differences, and optionally write both frames as PNGs.
#### Scenario: identical
- **WHEN** both casts render the same screen
- **THEN** exit code is 0 and nothing is printed

### Requirement: rec --browser
`tcut rec --browser <url>` SHALL record a browser pane during a live session using the same capture as scripted mode.
#### Scenario: live with browser
- **WHEN** `tcut rec --browser http://localhost:3000 -- bash -c "echo hi"` runs
- **THEN** the cast contains `b` events and the render composites the pane
### Requirement: cut and concat commands
`tcut cut <file.cast> --from/--to/--chapters [--cast out] [-o …]` SHALL write a new cast holding that part (flattened onto the visible timeline) and render `-o` outputs if given; `tcut concat <a.cast> <b.cast…> [--gap] [--cast out] [-o …]` SHALL join recordings of the same size end to end. Browser frames referenced by the inputs SHALL be copied beside the new cast.
#### Scenario: cut by time
- **WHEN** `tcut cut demo.cast --from 2s --to 10s`
- **THEN** `demo-cut.cast` is 8 s long and starts on the screen as it was at 2 s
### Requirement: clip and look flags
`render` and `<script>` SHALL accept `--from`, `--to`, `--chapters`, `--split-chapters`; every command that renders SHALL accept `--shadow`, `--watermark <text>`, `--watermark-image <file>` and `--margin-fill transparent`.
#### Scenario: chapters flag
- **WHEN** `tcut render demo.cast --chapters Zoom,Intro -o clip.mp4`
- **THEN** clip.mp4 contains the Zoom chapter followed by Intro
### Requirement: doctor command
`tcut doctor <file.cast>` SHALL replay the recording and report terminal features used (alt screen, mouse, bracketed paste, application cursor keys, synchronized output, hyperlinks, scrollback, titles), markers, unsupported image protocols, sequences the lite core does not handle, and notes; `--json` SHALL emit the report.
#### Scenario: kitty image
- **WHEN** the recording contains a Kitty graphics sequence
- **THEN** the report lists `kitty-graphics` with a note that images are not rendered
