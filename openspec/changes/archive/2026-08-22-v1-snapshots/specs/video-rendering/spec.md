## ADDED Requirements
### Requirement: Snapshot emission on every render path
Rendering SHALL emit snapshot marks regardless of the configured outputs: `.svg` stills headlessly from the grid replay, raster stills via the WebView pass — which SHALL run when raster marks exist even if no raster video output is configured. Snapshots SHALL be written on re-renders of existing casts (`tcut render x.cast`).

#### Scenario: snapshot without a video
- **WHEN** a recording contains a `.png` snapshot mark and only text outputs are configured
- **THEN** the WebView pass runs and the PNG is written and reported
