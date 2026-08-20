## ADDED Requirements
### Requirement: JSON output
With `--json` every command SHALL print exactly one JSON document on stdout (results, or `{ "error", "type" }` on failure with exit code 1) and no status lines.
#### Scenario: render
- **WHEN** `tcut render x.cast -o y.svg --json` succeeds
- **THEN** stdout is a JSON object with `outputs[].path/bytes`, `frames`, `durationSeconds`
