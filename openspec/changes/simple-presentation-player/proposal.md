## Why

Sam needs to prepare terminal, code-editing and browser content automatically, then narrate it with slideshow controls. Camera recording and live project execution make that workflow more complex than necessary.

## What Changes

- Restore prepared-media presentation instead of the shelved live-shell approach.
- Use a minimal React/Vite player matching the website stack, with fullscreen, scene selection, pause/hold/advance, replay and optional notes.
- Remove capture, takes, export jobs and live-shell endpoints from the simple player.
- Provide a complete scripted Vim edit → CLI → browser example and a local scale comparison for review.
- Carry the existing scale and command-echo fixes into this isolated local branch.

## Capabilities

### New Capabilities
- `presentation-player`: prepared-scene playback for external recording.

## Constraints

Local review only. Do not tag, publish, deploy or push the presentation branch. The user explicitly paused the separate scale release before tagging/publication.
