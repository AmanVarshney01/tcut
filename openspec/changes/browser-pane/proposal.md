## Why
Most "run my app" demos need the terminal and the browser together. tcut already has Bun.WebView.
## What Changes
- `browser: { url?, width?, height?, fps? }` opens a WebView during recording; changed frames are captured on the recording clock and stored beside the cast as `b` events (`<cast>.browser/NNNN.png`).
- `t.browser.goto/waitFor/click/reload/evaluate`.
- Raster rendering composites the terminal window and a browser window side by side inside the renderer page; SVG/HTML ignore the browser track (for now).
## Capabilities
### New Capabilities
- none
### Modified Capabilities
- `script-api`: browser pane config + session API.
- `video-rendering`: composite layout.
## Impact
types/config/recorder/video/cast/page/page-entry/webview, example.
