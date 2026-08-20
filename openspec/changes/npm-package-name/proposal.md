## Why

npm's typosquat filter rejected the package name `tcut` ("too similar to test, tsup"). The project, CLI command
and binaries keep the `tcut` name; only the npm package needs a different, unscoped name.

## What Changes

- npm package name becomes `termcut` (bin stays `tcut`).
- The CLI resolves both `"tcut"` and `"termcut"` as virtual module specifiers for user scripts.
- README install instructions and badge updated.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `distribution`: npm package name and import specifiers.

## Impact

`package.json`, `src/cli.ts`, `README.md`.
