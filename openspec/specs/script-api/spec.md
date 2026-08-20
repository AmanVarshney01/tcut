# script-api Specification

## Purpose
TBD - created by archiving change tcut-m1-pipeline. Update Purpose after archive.
## Requirements
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

### Requirement: Screen-driven navigation
Scripts SHALL be able to drive interactive TUIs by combining `wait(pattern, { scope: "screen" })`, key helpers and `screen()` reads in ordinary control flow (e.g. press `up` until the highlighted row matches), with `expect()` asserting the final selection.

#### Scenario: select a menu entry by label
- **WHEN** a script loops `t.up()` until `t.screen()` matches `/●\s+Cloudflare/` and then presses Enter
- **THEN** the scaffolder's config records `"webDeploy": "cloudflare"` regardless of the option order

### Requirement: Shift and scroll input
`t.shift(key, times?)` SHALL send Shift+Tab (`ESC [ Z`), shifted cursor/navigation keys (CSI `1;2` / `;2~` forms) and uppercase letters. `t.scrollUp(n)` / `t.scrollDown(n)` SHALL send SGR mouse-wheel events at the cursor when the program has enabled mouse tracking, and otherwise do nothing but log why.
#### Scenario: shift tab
- **WHEN** `t.shift("tab")` is called
- **THEN** `\x1b[Z` is written to the PTY
#### Scenario: scroll without mouse tracking
- **WHEN** `t.scrollDown()` is called at a plain shell prompt
- **THEN** nothing is written and the log explains that mouse tracking is off

### Requirement: Pixel sizing
`width`/`height` SHALL size the video in pixels. When `cols`/`rows` are not given they SHALL be derived from the font metrics so the grid fits; the rendered output SHALL be exactly `width × height` (rounded to even) with the terminal centred inside the frame.
#### Scenario: 1280×720
- **WHEN** `width: 1280, height: 720` and no cols/rows
- **THEN** the mp4 is 1280×720 and the terminal grid fits inside it

### Requirement: Browser pane
When `browser` is configured, recording SHALL capture screenshots of a WebView on the recording clock (deduplicated), persist them beside the cast, and reference them as `b` events; `t.browser` SHALL offer `goto`, `waitFor`, `click`, `reload`, `evaluate`. Raster outputs SHALL show the terminal and the browser side by side, with hidden intervals cut from both tracks.
#### Scenario: dev server demo
- **WHEN** a script starts a server, calls `t.browser.goto(url)`, edits a file and calls `t.browser.reload()`
- **THEN** the rendered mp4 shows the terminal on the left and the page before/after on the right

### Requirement: Captions
`t.print(markdown)` SHALL render Markdown to ANSI and write it into the recording and the screen model without sending anything to the PTY, then obtain a fresh prompt; `t.title(text)` SHALL render a heading and rule followed by a pause. Captions SHALL appear in every output format because they are ordinary terminal output in the cast.
#### Scenario: caption then command
- **WHEN** a script calls `t.print("## Step 1")` and then `t.run("ls")`
- **THEN** the video shows the bold heading above the command, the shell never receives "Step 1", and `ls` runs at a normal prompt

