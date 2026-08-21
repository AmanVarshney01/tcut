## ADDED Requirements
### Requirement: doctor command
`tcut doctor <file.cast>` SHALL replay the recording and report terminal features used (alt screen, mouse, bracketed paste, application cursor keys, synchronized output, hyperlinks, scrollback, titles), markers, unsupported image protocols, sequences the lite core does not handle, and notes; `--json` SHALL emit the report.
#### Scenario: kitty image
- **WHEN** the recording contains a Kitty graphics sequence
- **THEN** the report lists `kitty-graphics` with a note that images are not rendered
