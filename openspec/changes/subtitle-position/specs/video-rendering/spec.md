## ADDED Requirements

### Requirement: Preserve subtitle offsets in output
Raster video, SVG, HTML/site playback, snapshots and prepared presentation media SHALL honor authored caption offsets. Key chips sharing the caption edge SHALL remain clear of captions.

#### Scenario: render a raised subtitle
- **WHEN** a caption uses a custom offset and the recording is rendered or sought
- **THEN** the renderer applies that offset on the visible timeline
- **AND** old captions without offsets retain their existing placement
