## Why
Sharing a rendered demo should be one command. The user runs RustFS (S3-compatible) on a VPS; anything S3-compatible should work, and credentials must never ship in the package.
## What Changes
- `tcut publish <files…>`: content-addressed upload via `Bun.S3Client` to any S3-compatible endpoint; prints public URLs; `.cast` also gets a playable `.html`.
- `tcut publish --setup`: stores endpoint/bucket/keys in `~/.config/tcut/publish.json` (0600; env `TCUT_S3_*` overrides), creates the bucket and a public-read policy via SigV4-signed admin calls, and verifies with an anonymous GET.
- Default endpoint suggestion in setup: `https://s3.amanv.cloud`. No credentials are embedded.
## Capabilities
### New Capabilities
- `publishing`: upload + share links.
### Modified Capabilities
- `cli`: `publish` command.
## Impact
`src/publish.ts`, `src/cli.ts`, tests, docs.
