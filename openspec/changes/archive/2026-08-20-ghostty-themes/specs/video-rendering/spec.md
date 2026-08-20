## ADDED Requirements
### Requirement: Theme catalogue
The package SHALL bundle the Ghostty theme collection (≥ 500 themes) plus the built-ins, resolve theme names case- and punctuation-insensitively, keep built-in themes byte-stable (overriding generated collisions), and list/filter them with `tcut themes [query]`. Unknown names SHALL fail with suggestions.
#### Scenario: loose name
- **WHEN** `--theme "Gruvbox Dark"` is passed
- **THEN** the `gruvbox-dark` theme is used
#### Scenario: unknown name
- **WHEN** `--theme catpuccin` is passed
- **THEN** the error lists nearby theme names
