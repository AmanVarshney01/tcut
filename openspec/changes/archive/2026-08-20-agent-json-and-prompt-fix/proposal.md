## Why
Agents need machine-readable results, and full-screen programs (Claude Code) that exit back to a primary screen with stale text broke prompt detection.
## What Changes
- `--json`: one JSON document on stdout for run/record/render/rec/test/publish, or `{ error, type }` with exit 1.
- Prompt detection is cursor-relative (text left of the cursor), so residue right of the cursor no longer hides the prompt.
- `docs/llms.txt` agent guide, served at tcut.amanv.dev/llms.txt.
## Capabilities
### New Capabilities
- none
### Modified Capabilities
- `cli`: `--json`.
- `session-recording`: cursor-relative prompt detection.
## Impact
`src/cli.ts`, `src/screen.ts`, `src/recorder.ts`, docs, site.
