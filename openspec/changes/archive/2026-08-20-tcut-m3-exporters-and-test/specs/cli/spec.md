## MODIFIED Requirements

### Requirement: Commands
The `tcut` binary SHALL provide: `tcut <script.ts>` (record + render), `tcut record <script.ts>`, `tcut render <file.cast>`, `tcut test <path…>`, `tcut init [name]`, `tcut themes`, and `-h/--help`. `--force` SHALL bypass the cast cache.

#### Scenario: run a script
- **WHEN** `tcut examples/demo.ts` is executed
- **THEN** the cast and every configured output are written and their paths printed

#### Scenario: render an existing cast
- **WHEN** `tcut render demo.cast --theme dracula -o demo.gif` is executed
- **THEN** a GIF is produced from the cast with the Dracula theme without re-running the shell

#### Scenario: test command
- **WHEN** `tcut test examples/` is executed
- **THEN** each script is run in fast mode and a summary with exit status is produced
