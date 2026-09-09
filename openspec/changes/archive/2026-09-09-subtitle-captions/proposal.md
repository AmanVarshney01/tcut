## Why

Scripts can print Markdown into terminal cells and show transition cards, but cannot place readable subtitles over an active terminal. Add manually authored captions with social-video presets.

## What Changes

- Add nonblocking `t.caption(text, options)` and `t.caption(null)`.
- Offer classic, TikTok, Pop, and minimal presets with duration, top/bottom placement, font size, and color overrides.
- Store captions as cast markers and compute expiry on the shared timeline before speed/hide/idle transforms.
- Draw captions in raster, SVG, HTML, website playback and snapshots; retain expiry through cuts and reset captions between joined sections.
- Document the API and provide a rendered four-style example. No dependencies or release/version change.

## Capabilities

### Modified Capabilities
- `script-api`: subtitle overlay authoring independent of terminal text.
- `video-rendering`: deterministic caption presentation and playback across output formats.

## Impact

Recorder, timeline, cast editing, all visual renderers, website player, public types, reference docs and tests. Existing recordings remain compatible. Captions are manually authored and burned into visual exports, without transcription or selectable subtitle tracks.
