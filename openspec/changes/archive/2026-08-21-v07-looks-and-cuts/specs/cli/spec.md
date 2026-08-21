## ADDED Requirements
### Requirement: cut and concat commands
`tcut cut <file.cast> --from/--to/--chapters [--cast out] [-o …]` SHALL write a new cast holding that part (flattened onto the visible timeline) and render `-o` outputs if given; `tcut concat <a.cast> <b.cast…> [--gap] [--cast out] [-o …]` SHALL join recordings of the same size end to end. Browser frames referenced by the inputs SHALL be copied beside the new cast.
#### Scenario: cut by time
- **WHEN** `tcut cut demo.cast --from 2s --to 10s`
- **THEN** `demo-cut.cast` is 8 s long and starts on the screen as it was at 2 s
### Requirement: clip and look flags
`render` and `<script>` SHALL accept `--from`, `--to`, `--chapters`, `--split-chapters`; every command that renders SHALL accept `--shadow`, `--watermark <text>`, `--watermark-image <file>` and `--margin-fill transparent`.
#### Scenario: chapters flag
- **WHEN** `tcut render demo.cast --chapters Zoom,Intro -o clip.mp4`
- **THEN** clip.mp4 contains the Zoom chapter followed by Intro
