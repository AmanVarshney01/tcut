## 1. Authoring and timeline
- [x] 1.1 Add typed caption options, recorder markers and validation.
- [x] 1.2 Normalize expiry before timeline transforms; preserve replacement and repeated flattening semantics.
- [x] 1.3 Retain active captions through cuts and clear them at join seams.

## 2. Rendering
- [x] 2.1 Share caption presentation and DOM painting across raster, HTML and site playback.
- [x] 2.2 Add vector captions and animation steps to SVG and SVG snapshots.
- [x] 2.3 Test idle raster repainting, expiry, HTML seeking and text escaping/wrapping.

## 3. Documentation and verification
- [x] 3.1 Update README, reference and agent reference; sync the npm README.
- [x] 3.2 Add a four-style example, render MP4/GIF and inspect the contact sheet.
- [x] 3.3 Complete final lint, typecheck, tests, build and OpenSpec validation.

Validation: full suite 164 CLI + 5 web tests passed; the subsequently added key-chip layout regression and all 10 caption tests passed. Lint, all four typechecks, binary/site builds, compiled-binary SVG/HTML export, strict OpenSpec validation and diff whitespace checks passed. Demo: `out/captions-demos/styles.mp4` (14.8s), GIF and contact sheet.
