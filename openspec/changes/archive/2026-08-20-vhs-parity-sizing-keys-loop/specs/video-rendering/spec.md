## ADDED Requirements
### Requirement: Loop offset
`loopOffset` (a frame count or a percentage string) SHALL rotate the frame sequence for looping outputs (GIF, WebP) so playback starts at that frame and the preceding frames play at the end; other outputs are unchanged.
#### Scenario: 50%
- **WHEN** `loopOffset: "50%"` and the render has 100 frames
- **THEN** the GIF's first frame is the original frame 50
