## Why

The site only had a light theme; users expect it to follow their OS and to be switchable.

## What Changes

- Dark token set (`[data-theme=dark]`), OS-preference default, header toggle persisted in localStorage, no flash on load.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `website`: light and dark themes.

## Impact

`apps/web/src/styles/global.css`, `Layout.astro`, `index.astro`.
