## Why

Video-player controls can cover subtitles close to the bottom edge. Authors need to move captions up without changing their style or switching to the top.

## What Changes

- Add a pixel `offset` to `t.caption()` measured inward from the selected top/bottom edge, default 16.
- Preserve placement across raster, SVG, HTML and site playback, snapshots and prepared presentations.
- Keep key chips clear of positioned captions.
- Add an example, documentation and regression checks. Remain local; no release or push.

## Capabilities

### Modified Capabilities
- `script-api`: configurable caption inset.
- `video-rendering`: consistent subtitle positioning.
