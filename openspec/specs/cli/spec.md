# cli Specification

## Purpose
TBD - created by archiving change tcut-m1-pipeline. Update Purpose after archive.
## Requirements
### Requirement: Commands
The `tcut` binary SHALL provide: `tcut <script.ts>` (record + render), `tcut record <script.ts>`, `tcut render <file.cast>`, `tcut init [name]`, `tcut themes`, and `-h/--help`.

#### Scenario: run a script
- **WHEN** `tcut examples/demo.ts` is executed
- **THEN** the cast and every configured output are written and their paths printed

#### Scenario: render an existing cast
- **WHEN** `tcut render demo.cast --theme dracula -o demo.gif` is executed
- **THEN** a GIF is produced from the cast with the Dracula theme without re-running the shell

### Requirement: Overrides
Flags `-o/--output` (repeatable), `--theme`, `--font`, `--font-size`, `--fps`, `--speed`, `--padding`, `--margin`, `--radius`, `--window-bar`, `--title`, `--no-blink`, `-q/--quiet` SHALL override the script's render config without modifying the script.

#### Scenario: theme override
- **WHEN** a script specifies `theme: "catppuccin-mocha"` and `--theme dracula` is passed
- **THEN** the output uses Dracula colours

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

