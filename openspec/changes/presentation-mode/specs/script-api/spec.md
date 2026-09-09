## ADDED Requirements

### Requirement: Named recorded steps
`t.step(title, callback, { notes? })` SHALL record named boundaries and speaker notes, execute the callback during source recording and return its result. Empty titles and nested steps SHALL be rejected.

#### Scenario: authored walkthrough
- **WHEN** a script contains two steps and setup outside those callbacks
- **THEN** both callbacks execute once during recording
- **AND** preparation creates two steps excluding the outside setup

#### Scenario: backwards compatibility
- **WHEN** a recording has chapters but no explicit steps
- **THEN** chapters define the steps and any introduction is retained
- **AND** an unmarked recording becomes one whole-recording step
