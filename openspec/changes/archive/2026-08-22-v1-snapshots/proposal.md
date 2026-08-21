# v1-snapshots: t.snapshot — stills at script-marked moments

## Why
Getting a screenshot out of tcut meant rendering a video and fishing out a frame, or guessing `--from` timestamps. The script sits at the exact moment worth capturing and should be able to name it. This is the 1.0 release.

## What Changes
- `t.snapshot(file)` becomes the primary still-capture API (`t.screenshot` stays as an alias; the cast marker stays `screenshot:` so existing casts, cut and concat keep working).
- `.svg` snapshots: static, non-animated SVG of the marked frame, produced headlessly from the shared grid replay — selectable text, no WebView.
- `.png` (and other raster) snapshots keep going through the WebView pass, which now runs even when no raster video output is configured.
- Vector snapshots use the same batch semantics as the raster pass: a mark captures the first frame tick at or after its instant, so output recorded just before it is included.
- Snapshots are emitted by every render path (`tcut <script>`, `tcut render x.cast`), reported in `result.screenshots` and `--json`.

## Impact
- Affected specs: script-api, video-rendering
- Affected code: recorder.ts, types.ts, render.ts, export/svg.ts, renderer/webview.ts, cli.ts (init template)
