## MODIFIED Requirements

### Requirement: npm package contents
The published npm package SHALL be named `termcut`, SHALL contain only `src/`, `scripts/`, `README.md` and `LICENSE`, SHALL declare `engines.bun >= 1.4.0`, and SHALL expose the `tcut` bin and the `"termcut"` module entry. Installing it with `bun add -g termcut` SHALL make `tcut` runnable without a build step. The CLI SHALL resolve both `"tcut"` and `"termcut"` import specifiers in user scripts to its own API.

#### Scenario: dry run
- **WHEN** `bun publish --dry-run` is executed
- **THEN** the package name is `termcut` and the file list contains no `out/`, `dist/`, `node_modules/` entries

#### Scenario: either specifier works under the CLI
- **WHEN** a script imports from `"tcut"` or from `"termcut"` and is run with `tcut <script>`
- **THEN** `defineVideo` resolves without a `node_modules` directory
