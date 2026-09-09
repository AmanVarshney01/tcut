## ADDED Requirements

### Requirement: Styled subtitle rendering
Visual outputs SHALL render subtitle captions with classic, tiktok, pop, or minimal presentation. TikTok SHALL highlight words in sequence and Pop SHALL animate an entrance. Animation SHALL use the visible render clock, and caption expiry SHALL follow speed, hidden intervals and idle compression without extending recording duration.

#### Scenario: seek backwards
- **WHEN** HTML or website playback seeks backwards into a caption
- **THEN** the matching text and animation state are recomputed at that instant

#### Scenario: idle terminal
- **WHEN** a caption animates, replaces another caption, or expires while terminal output is idle
- **THEN** raster and animated SVG output update the overlay

### Requirement: Subtitle persistence through edits and stills
Cuts SHALL retain active subtitle text and remaining expiry, restarting entrance/highlighting at the cut. Joins SHALL clear captions at section seams. Raster and SVG snapshots SHALL draw the caption at the capture time. Text SHALL be escaped safely in every visual output.

#### Scenario: cut through a caption
- **WHEN** a cut starts two seconds into a four-second caption
- **THEN** the first frame shows the caption and it expires two seconds into the clip
