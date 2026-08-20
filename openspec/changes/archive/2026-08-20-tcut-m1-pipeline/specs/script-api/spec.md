## ADDED Requirements

### Requirement: defineVideo entry point
The package SHALL export `defineVideo(config, script)` returning a `Video` object with `record()`, `render()` and `run()`; a script file SHALL `export default` that object so the CLI can load it.

#### Scenario: valid script module
- **WHEN** a `.ts` file default-exports the result of `defineVideo`
- **THEN** `tcut <file>` records and renders it without further configuration

#### Scenario: invalid script module
- **WHEN** the default export is not a `Video`
- **THEN** the CLI exits non-zero with a message naming the expected export shape

### Requirement: Typing and key input
`t.type(text, {speed})` SHALL send one character at a time with the configured per-character delay, translating `"\n"` to Enter. Key helpers (`enter`, `tab`, `backspace`, `delete`, `escape`, `space`, arrows, `home`, `end`, `pageUp`, `pageDown`, `ctrl(letter)`, `alt(key)`, `key(name, times)`) SHALL send the xterm escape sequences for those keys. `paste(text)` SHALL send text without delay. `raw(bytes)` SHALL write verbatim.

#### Scenario: typing with jitter is reproducible
- **WHEN** `typingJitter > 0` and the same `seed` are used for two recordings of the same script
- **THEN** the per-character delays are identical in both recordings

#### Scenario: ctrl key
- **WHEN** the script calls `t.ctrl("c")`
- **THEN** byte `0x03` is written to the PTY

### Requirement: run() waits for the prompt
`t.run(cmd)` SHALL type `cmd`, press Enter, and block until the prompt pattern matches the cursor line on a line different from the echoed command (or the line content changed, e.g. after `clear`). It SHALL throw a timeout error that includes a screen dump when the prompt does not return within `waitTimeout`. `{ wait: false }` SHALL skip waiting; `{ wait: /re/ }` SHALL wait for that pattern instead.

#### Scenario: command completes
- **WHEN** `t.run("echo hi")` is called in a shell whose prompt is `> `
- **THEN** the promise resolves only after `hi` has been printed and `> ` is on the cursor line

#### Scenario: command never returns
- **WHEN** `t.run("sleep 100", { timeout: "1s" })` is called
- **THEN** a `WaitTimeoutError` is thrown whose message contains the current screen text

### Requirement: wait() and expect()
`t.wait(pattern?, {scope, timeout})` SHALL resolve when `pattern` (default: prompt pattern) matches the cursor line (`scope: "line"`, default) or the whole screen (`scope: "screen"`). `t.expect(pattern, {scope})` SHALL settle pending output then assert an immediate match, throwing `ExpectationError` with a screen dump otherwise. String patterns SHALL be matched literally.

#### Scenario: expect succeeds
- **WHEN** the screen contains `notes.txt` and the script calls `t.expect(/notes\.txt/)`
- **THEN** the call resolves

#### Scenario: expect fails
- **WHEN** the screen does not contain the pattern
- **THEN** `ExpectationError` is thrown and the recording is aborted

### Requirement: hide() scopes
`t.hide(fn)` SHALL run `fn`, keep all of its effects on terminal state, and mark the interval so the renderer cuts it from the video. Nested `hide()` calls SHALL collapse into one interval.

#### Scenario: setup commands are cut
- **WHEN** a script runs `t.hide(() => t.run("cd /tmp && clear"))` followed by visible commands
- **THEN** the rendered video never shows the `cd` command but starts from the cleared screen

### Requirement: screenshot, marker, resize, clear
`t.screenshot(path)` SHALL record a marker that causes the renderer to write a PNG of that instant. `t.marker(name)` SHALL record a custom marker. `t.resize(cols, rows)` SHALL resize the PTY and the screen model and record an `r` event. `t.clear()` SHALL be equivalent to `t.run("clear")`.

#### Scenario: screenshot marker renders a PNG
- **WHEN** the script calls `t.screenshot("out/a.png")` and the video is rendered
- **THEN** `out/a.png` exists and matches the frame at that time

### Requirement: Screen introspection
`t.screen()`, `t.line()`, `t.cursor()`, `t.cols`, `t.rows` SHALL reflect the headless screen model at call time.

#### Scenario: read the prompt line
- **WHEN** the shell is idle at its prompt
- **THEN** `t.line()` ends with the configured prompt text

### Requirement: Durations
Every duration option and argument SHALL accept a number of milliseconds or a string with `ms`, `s`, or `m` units.

#### Scenario: string duration
- **WHEN** `t.sleep("1.5s")` is called
- **THEN** the recorder waits 1500 ms
