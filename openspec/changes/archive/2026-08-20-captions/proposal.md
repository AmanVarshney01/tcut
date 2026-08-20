## Why
Narration in terminal demos is faked with `echo`. A caption primitive that renders Markdown into the recording reads better and never touches the shell.
## What Changes
- `t.print(markdown)` renders Markdown to ANSI with @wterm/markdown and injects it into the cast + screen model, then asks the shell for a fresh prompt. `t.title(text, { pause })` = heading + rule + pause.
## Capabilities
### New Capabilities
- none
### Modified Capabilities
- `script-api`: captions.
## Impact
`src/recorder.ts`, types, docs, tests; new dependency @wterm/markdown (pure JS, same family as the emulator).
