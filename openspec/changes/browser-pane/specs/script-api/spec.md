## ADDED Requirements
### Requirement: Browser pane
When `browser` is configured, recording SHALL capture screenshots of a WebView on the recording clock (deduplicated), persist them beside the cast, and reference them as `b` events; `t.browser` SHALL offer `goto`, `waitFor`, `click`, `reload`, `evaluate`. Raster outputs SHALL show the terminal and the browser side by side, with hidden intervals cut from both tracks.
#### Scenario: dev server demo
- **WHEN** a script starts a server, calls `t.browser.goto(url)`, edits a file and calls `t.browser.reload()`
- **THEN** the rendered mp4 shows the terminal on the left and the page before/after on the right
