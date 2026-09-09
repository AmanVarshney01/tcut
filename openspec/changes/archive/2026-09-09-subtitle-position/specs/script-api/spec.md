## ADDED Requirements

### Requirement: Subtitle edge offset
`t.caption()` SHALL accept an optional non-negative finite pixel `offset` measured inward from its selected top or bottom edge. Omitted offset SHALL remain 16 pixels. Invalid offsets SHALL be rejected.

#### Scenario: raise bottom subtitles
- **WHEN** an author sets `position: "bottom", offset: 64`
- **THEN** the caption is placed 64 pixels from the bottom edge
- **AND** its style, colors and timing are retained

#### Scenario: top subtitles
- **WHEN** an author sets `position: "top", offset: 48`
- **THEN** the caption is inset 48 pixels from the top, below any window bar
