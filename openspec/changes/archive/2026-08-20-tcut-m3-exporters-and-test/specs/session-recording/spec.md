## ADDED Requirements

### Requirement: Cast caching
When `cache` is enabled (default) and a cast exists at the configured path whose header `scriptHash` equals the SHA-256 (via `Bun.CryptoHasher`) of the script source plus the record-relevant config, `run()` SHALL skip recording and reuse the cast. `--force` / `{ force: true }` SHALL bypass the cache. The hash SHALL be written into the header on every recording.

#### Scenario: cache hit
- **WHEN** a script is run twice without changes
- **THEN** the second run does not spawn a shell and reports the cast as reused

#### Scenario: cache miss after edit
- **WHEN** the script file changes
- **THEN** the next run re-records
