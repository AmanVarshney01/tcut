# script-testing Specification

## Purpose
TBD - created by archiving change tcut-m3-exporters-and-test. Update Purpose after archive.
## Requirements
### Requirement: tcut test command
`tcut test <path…>` SHALL accept script files and directories (recursively matching `*.video.ts` and `*.tcut.ts`), run each script's recording in fast mode without rendering or writing casts, print one line per script with pass/fail and duration, and exit 1 if any script fails.

#### Scenario: passing suite
- **WHEN** all scripts complete without `ExpectationError`/`WaitTimeoutError`/shell exit
- **THEN** the exit code is 0 and the summary reports N passed

#### Scenario: failing expect
- **WHEN** one script's `expect()` fails
- **THEN** its error and screen dump are printed and the exit code is 1

### Requirement: Fast mode
In fast mode the recorder SHALL treat `typingSpeed` as 0 and `sleep()` as a no-op, while `wait()`/`run()` timeouts remain in effect.

#### Scenario: no artificial delays
- **WHEN** a script with `sleep("10s")` runs under `tcut test`
- **THEN** it finishes in well under 10 s

