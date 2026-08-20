# session-recording Specification

## Purpose
TBD - created by archiving change tcut-m1-pipeline. Update Purpose after archive.
## Requirements
### Requirement: PTY via Bun.Terminal
The recorder SHALL spawn the shell with `Bun.spawn(cmd, { terminal: { cols, rows, name: "xterm-256color" } })` and SHALL use `proc.terminal` for all input, resize and lifecycle. It MUST NOT depend on node-pty or any native addon.

#### Scenario: shell runs in a PTY
- **WHEN** the recorder starts with `shell: "bash"`
- **THEN** `tput cols` inside the session prints the configured `cols`

### Requirement: Clean, deterministic shell setup
For named shells (`bash`, `zsh`, `fish`, `sh`) the recorder SHALL start the shell without user rc files, with the configured prompt, no history file, `TERM=xterm-256color`, and the user's `env` overrides applied last. An explicit `string[]` shell command SHALL be run verbatim.

#### Scenario: bash prompt
- **WHEN** `shell: "bash"` and `prompt: "> "`
- **THEN** the first line of output ends with `> ` and no rc-file banner appears

### Requirement: Headless screen model
Every PTY output chunk SHALL be appended to the recording and fed to a headless Ghostty `TerminalCore` so that `wait`, `expect`, `run` and introspection operate on the rendered screen, not raw bytes. Terminal responses produced by the core (`getResponse()`) SHALL be written back to the PTY.

#### Scenario: application queries the terminal
- **WHEN** a program sends a Device Attributes query (`ESC [ c`)
- **THEN** the recorder writes the core's response to the PTY so the program does not hang

### Requirement: Recording starts at first prompt
The recorder SHALL wait for the prompt pattern before running the script and SHALL stamp all output before that instant at time 0, so shell start-up noise is not part of the timeline.

#### Scenario: first frame shows the prompt
- **WHEN** the script's first action is `t.sleep("1s")`
- **THEN** frame 0 of the rendered video already shows the prompt

### Requirement: Asciicast v2 output with markers
The recording SHALL be written as asciicast v2 (`{version:2,width,height,…}` header, then `[time,"o"|"i"|"r"|"m",data]` events). Hidden intervals SHALL be recorded as `m` markers `hide` / `show`; screenshots as `screenshot:<path>`; custom markers verbatim; the end as `end`. The header SHALL embed the resolved config under `bunVideo` so the cast can be re-rendered without the script.

#### Scenario: playable by asciinema
- **WHEN** a recording is saved
- **THEN** `asciinema play <file>` / asciinema-player accept it

### Requirement: End pause and teardown
After the script resolves the recorder SHALL wait `endPause`, emit the `end` marker, close the terminal, and kill the shell if still running. Script errors SHALL still tear the process down.

#### Scenario: script throws
- **WHEN** the script throws
- **THEN** the shell process is killed and the error propagates with its message intact

### Requirement: Quantized timestamps
When `quantize` is true the recorder SHALL round every event timestamp up to the next `1/fps` boundary before writing the cast.

#### Scenario: quantized cast
- **WHEN** `quantize: true` and `fps: 60`
- **THEN** every event time × 60 is an integer (within floating-point tolerance)

### Requirement: Core selection for the screen model
The recorder's headless screen model SHALL use Ghostty by default and wterm's lite core when `core: "lite"`.

#### Scenario: lite recording
- **WHEN** `core: "lite"` is configured
- **THEN** `run()`, `wait()` and `expect()` still operate on the rendered screen

### Requirement: Cast caching
When `cache` is enabled (default) and a cast exists at the configured path whose header `scriptHash` equals the SHA-256 (via `Bun.CryptoHasher`) of the script source plus the record-relevant config, `run()` SHALL skip recording and reuse the cast. `--force` / `{ force: true }` SHALL bypass the cache. The hash SHALL be written into the header on every recording.

#### Scenario: cache hit
- **WHEN** a script is run twice without changes
- **THEN** the second run does not spawn a shell and reports the cast as reused

#### Scenario: cache miss after edit
- **WHEN** the script file changes
- **THEN** the next run re-records

