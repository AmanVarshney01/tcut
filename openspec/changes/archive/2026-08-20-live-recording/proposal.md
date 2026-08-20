## Why

Scripting key presses is the wrong tool when you just want to capture a session you drive yourself. Users expect an asciinema-style "record what I do" mode that feeds the same render pipeline.

## What Changes

- `recordLive()` / `tcut rec [-- command]`: PTY passthrough with raw-mode stdin, output mirrored to the terminal, keystrokes/timing/resizes captured to a cast, then rendered with the normal options.
- Example and README clarify that scripted mode records real output too; only input is scripted.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `session-recording`: live mode.
- `cli`: `rec` command.

## Impact

`src/live.ts`, `src/cli.ts`, `src/index.ts`, tests, README, `examples/better-t-stack.ts`.
