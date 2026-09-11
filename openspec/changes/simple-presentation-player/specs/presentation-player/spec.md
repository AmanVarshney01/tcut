## ADDED Requirements

### Requirement: Prepare once and present repeatedly
The player SHALL render source content before presentation and SHALL only play prepared clips during delivery.

#### Scenario: Repeat a scene
- **WHEN** the presenter replays or navigates backwards
- **THEN** the original commands and project setup do not execute again

### Requirement: Slideshow playback
The player SHALL support scene selection, play/pause, manual advancement after a hold, replay, seeking and persistent playback speed.

#### Scenario: Scene end
- **WHEN** a clip ends
- **THEN** its last frame stays visible until the presenter advances

#### Scenario: Navigation boundary
- **WHEN** the presenter navigates before the first or after the last scene
- **THEN** the current clip is not reset

### Requirement: Fullscreen external recording
The stage SHALL support fullscreen with controls that disappear after pointer inactivity. The application SHALL fit the viewport and SHALL not request webcam, microphone or screen-recording access.

#### Scenario: Narrating a scene
- **WHEN** the presenter enters fullscreen and stops moving the pointer
- **THEN** the prepared scene remains visible without transport or speaker notes

### Requirement: Prepared code and browser demonstration
The example SHALL show code, a scripted editor change, CLI execution and browser output captured during preparation.

#### Scenario: Playback after project shutdown
- **WHEN** the temporary editor project and server have been cleaned up
- **THEN** their prepared scenes remain playable
