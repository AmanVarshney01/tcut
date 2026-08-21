## ADDED Requirements
### Requirement: diff command
`tcut diff a.cast b.cast [--at t] [--images dir]` SHALL compare the rendered screen text of both casts at the end (or at `--at`), print a unified diff, exit 1 on differences, and optionally write both frames as PNGs.
#### Scenario: identical
- **WHEN** both casts render the same screen
- **THEN** exit code is 0 and nothing is printed
### Requirement: rec --browser
`tcut rec --browser <url>` SHALL record a browser pane during a live session using the same capture as scripted mode.
#### Scenario: live with browser
- **WHEN** `tcut rec --browser http://localhost:3000 -- bash -c "echo hi"` runs
- **THEN** the cast contains `b` events and the render composites the pane
