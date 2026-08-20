# publishing Specification

## Purpose
TBD - created by archiving change publish-s3. Update Purpose after archive.
## Requirements
### Requirement: Publish to S3-compatible storage
`tcut publish <files…>` SHALL upload each file to the configured S3-compatible bucket under a content-hashed key (`<sha256[0:12]>/<name>`) using Bun's S3 client and print the public URL; a `.cast` SHALL additionally be rendered to `.html` and uploaded. Configuration SHALL come from `~/.config/tcut/publish.json` (mode 0600) overridden by `TCUT_S3_*` environment variables; the package SHALL embed no credentials.
#### Scenario: publish a gif
- **WHEN** `tcut publish demo.gif` runs with a valid config
- **THEN** the file is uploaded and `https://<public>/<hash>/demo.gif` is printed and serves the file

### Requirement: Setup bootstraps the bucket
`tcut publish --setup` SHALL save the config, create the bucket if missing, apply a public-read bucket policy, and verify an anonymous GET succeeds, reporting each step.
#### Scenario: first-time setup against RustFS
- **WHEN** setup runs with valid keys for an empty RustFS
- **THEN** the bucket exists, is publicly readable, and the config file is written

