## ADDED Requirements

### Requirement: Reusable presentation source
Preparation SHALL preserve existing recorded visuals and store reusable source media, isolated step clips and posters. Takes SHALL reference the source revision they used.

#### Scenario: repeated preparation
- **WHEN** an unchanged recording and configuration are prepared again
- **THEN** valid prepared assets are reused
- **AND** original script commands are not executed by preparation

### Requirement: Paced take export
MP4, WebM and GIF exports SHALL reproduce recorded holds, playback speed, seeks and backwards replay using prepared pixels. MP4 and WebM SHALL include microphone audio when present; GIF SHALL remain silent.

#### Scenario: explain then replay
- **WHEN** a take holds a frame, plays another step and returns to an earlier frame
- **THEN** the export reproduces that order and total duration within one output frame
- **AND** optional narration continues across holds
