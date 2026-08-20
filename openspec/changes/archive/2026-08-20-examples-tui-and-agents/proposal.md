## Why

The shipped examples only drive plain shell commands. Users asked for demos of what tcut is actually for:
driving an interactive TUI (`bun create better-t-stack`) and recording AI coding agents (Claude Code, Codex).

## What Changes

- `examples/better-t-stack.ts`: interactive scaffolder driven with arrow keys/Enter, selecting options by reading the screen.
- `examples/ai-agents.ts`: `claude -p` and `codex exec` answering/editing a file; guarded on the binaries being installed.
- GIFs of both committed under `packages/tcut/docs/examples/`; README "Examples" section; website "Examples" section.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `script-api`: documents the screen-driven selection pattern (`t.screen()` in a loop) as supported usage.

## Impact

`packages/tcut/examples/*`, `packages/tcut/docs/examples/*`, READMEs, `apps/web`.
