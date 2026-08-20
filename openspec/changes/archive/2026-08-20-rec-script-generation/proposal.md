## Why
`tcut rec` captures a session but gives nothing editable back. Users want a script by default — like `vhs record` — while keeping the exact cast.
## What Changes
- `tcut rec` writes `<name>.video.ts` next to the cast (opt out with `--no-script`): typed lines become `run()` in clean-shell mode, keys map to helpers, pauses become `sleep()`; `-- command` mode sets `shell: [command]`.
- Scripted recorder skips the initial prompt wait when `shell` is a command array.
## Capabilities
### New Capabilities
- none
### Modified Capabilities
- `session-recording`: script generation from live recordings; command-array shells.
- `cli`: `--no-script`.
## Impact
`src/scriptgen.ts`, `src/recorder.ts`, `src/cli.ts`, tests.
