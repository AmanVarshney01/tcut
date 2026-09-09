## ADDED Requirements

### Requirement: Subtitle overlay authoring
`t.caption(text, options?)` SHALL record a subtitle without sending it to the PTY or terminal screen and SHALL return immediately. Options SHALL include classic, tiktok, pop and minimal styles, duration, top/bottom position, fontSize, color, background and highlightColor. `t.caption(null)` SHALL clear the overlay. Omitted duration SHALL persist until replacement, clear, or video end.

#### Scenario: command beneath a caption
- **WHEN** a script awaits a three-second caption and then runs a command
- **THEN** the command begins immediately and runs beneath the caption
- **AND** the caption text is absent from terminal screen assertions and transcripts

#### Scenario: replacement with pending expiry
- **WHEN** a timed caption is replaced before it expires
- **THEN** its old expiry does not clear the replacement
