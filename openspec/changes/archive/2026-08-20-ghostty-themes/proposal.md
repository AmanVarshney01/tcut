## Why
Five themes is thin; Ghostty ships ~600 (from mbadolato/iTerm2-Color-Schemes, MIT) and our renderer *is* Ghostty, so the names can mean the same colours in the terminal and the video.
## What Changes
- `scripts/build-themes.ts` generates `src/themes.generated.json` from the Ghostty-format collection; committed.
- `resolveTheme` matches names loosely ("Catppuccin Mocha" = `catppuccin-mocha`); built-ins stay byte-stable and override collisions.
- `tcut themes [query]` lists/filters.
## Capabilities
### New Capabilities
- none
### Modified Capabilities
- `video-rendering`: theme catalogue and name resolution.
## Impact
`src/themes.ts`, `src/themes.generated.json`, `src/types.ts`, `src/cli.ts`, tests.
