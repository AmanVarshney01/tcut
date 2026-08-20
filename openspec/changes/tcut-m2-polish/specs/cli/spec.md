## MODIFIED Requirements

### Requirement: Overrides
Flags `-o/--output` (repeatable), `--theme`, `--font`, `--font-size`, `--line-height`, `--letter-spacing`, `--fps`, `--speed`, `--padding`, `--margin`, `--margin-fill`, `--radius`, `--window-bar`, `--title`, `--no-blink`, `--core`, `--cast`, `-q/--quiet` SHALL override the script's config without modifying the script. `--record-only` SHALL stop after writing the cast.

#### Scenario: theme override
- **WHEN** a script specifies `theme: "catppuccin-mocha"` and `--theme dracula` is passed
- **THEN** the output uses Dracula colours

#### Scenario: record only
- **WHEN** `tcut demo.ts --record-only` is run
- **THEN** the cast is written and no video outputs are produced
