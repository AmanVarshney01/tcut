## ADDED Requirements
### Requirement: Script generation from live recordings
`generateScript(recording)` SHALL convert the input events of a recording into a `defineVideo` script: printable runs → `type()`, known escape/control sequences → key helpers (`enter`, `up`, `ctrl("c")`, …), inter-key gaps above a threshold → `sleep()`, and, when the recording drove the clean shell, "text + Enter" → `run()`. `tcut rec` SHALL write this script next to the cast unless `--no-script`.
#### Scenario: clean shell round trip
- **WHEN** a live session typed `echo hi` + Enter
- **THEN** the generated script contains `await t.run("echo hi")` and re-running it reproduces the output
### Requirement: Command-array shells start immediately
When `shell` is a command array the scripted recorder SHALL NOT wait for a prompt before running the script.
#### Scenario: generated command-mode script
- **WHEN** a script has `shell: ["bash", "-c", "echo x"]`
- **THEN** recording starts without a prompt timeout
