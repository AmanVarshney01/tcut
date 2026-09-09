- [x] Add and validate caption offset with backward-compatible defaults.
- [x] Apply offsets to all renderers and key-chip spacing.
- [x] Document and demonstrate top/bottom positioning.
- [x] Verify offset behavior, examples, lint, types, tests and builds.

Verification: 166 tcut tests and 5 web tests passed; lint, all typechecks, builds and strict OpenSpec validation passed. Rendered the positioning example to MP4, HTML, SVG and PNG and inspected the raised-caption snapshot. Caption tests cover all styles, unchanged defaults, zero/custom/invalid offsets, top window-bar clearance, HTML seeking and key-chip spacing.
