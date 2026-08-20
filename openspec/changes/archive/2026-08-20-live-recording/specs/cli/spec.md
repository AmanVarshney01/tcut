## ADDED Requirements

### Requirement: rec command
`tcut rec [options] [-- command…]` SHALL record a live session (the clean shell by default, or `command`), write the cast, and render to `-o` outputs (default `rec.mp4`) unless `--record-only`. Render option flags SHALL apply.

#### Scenario: rec with command
- **WHEN** `tcut rec --cast s.cast -o s.svg -- bash -c "echo x"` runs
- **THEN** `s.cast` contains `x` and `s.svg` is written
