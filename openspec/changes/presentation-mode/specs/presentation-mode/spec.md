## ADDED Requirements

### Requirement: Local presentation workflow
`tcut present` SHALL prepare a script or cast and serve a local presenter. Preparation-only mode SHALL exit after writing assets. Typing speed and jitter overrides SHALL apply to script recording.

#### Scenario: manual flow
- **WHEN** a recorded step finishes
- **THEN** it holds until the presenter advances
- **AND** pause, resume, seek, replay, backwards navigation and speed controls remain available without rerunning commands

### Requirement: Presenter and audience views
The presenter SHALL use a full-width minimal layout with collapsible notes, settings and take history, keyboard controls, audience preview and fullscreen. A separate same-browser audience window SHALL synchronize playback without speaker notes.

#### Scenario: private notes
- **WHEN** the presenter edits notes and changes steps
- **THEN** edits persist locally for each step
- **AND** the audience sees recorded visuals without speaker notes or presenter controls

### Requirement: Multiple local takes
The presenter SHALL capture pacing with optional microphone audio, persist multiple takes and offer review, export progress, downloads and recoverable error states.

#### Scenario: another recording attempt
- **WHEN** the user starts a second take
- **THEN** it reuses prepared media without executing source commands
- **AND** earlier takes remain available after a server restart

#### Scenario: save failure
- **WHEN** saving a captured take fails
- **THEN** the page retains its draft and offers retry while it remains open
