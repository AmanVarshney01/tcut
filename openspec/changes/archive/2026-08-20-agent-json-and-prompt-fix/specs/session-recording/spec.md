## ADDED Requirements
### Requirement: Cursor-relative prompt detection
Prompt detection (`run()`, `wait()` with no pattern, start-up) SHALL test the prompt pattern against the cursor line up to the cursor column, so stale text to the right of the cursor (e.g. left by a program that used the alternate screen) does not prevent detection.
#### Scenario: residue after a TUI exits
- **WHEN** the prompt is printed over a line that still contains old text after the cursor
- **THEN** `run()` returns once the prompt is visible left of the cursor
