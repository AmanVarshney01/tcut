## Decisions

`caption()` records a marker and returns immediately. A duration does not sleep or extend the recording; omitted duration persists until replacement/clear/end. The original terminal and transcript remain untouched.

Timed markers expand to a start and matching expiry before timeline transforms. Expiry IDs prevent an old caption's expiry from clearing its replacement. Normalized starts omit duration, so flattening is idempotent. The shared cue and presentation functions determine the active word and Pop scale from the visible clock, including when seeking backwards. TikTok highlights words evenly across a closed cue or at 350ms per word for an open-ended cue.

DOM renderers share safe text-node construction and CSS. SVG uses vector text with approximate font metrics for wrapping and samples animations on the configured frame clock. Raster caching considers caption presentation changes even when the terminal is idle.

Cuts seed the active caption at the new start and retain its remaining expiry; entrance/highlight restart at the cut. Joins clear a preceding caption at the seam. Captions are positioned inside the terminal window, above transition cards and outside terminal zoom; same-side key chips move away from captions.

## Validation

Regression tests cover record/clear behavior, zero duration, replacement, speed/hide/idle transforms, repeated flattening, cuts/joins, deterministic animation, escaped text in SVG/HTML, SVG snapshots, raster changes over idle output, HTML seeking and long-text wrapping, and website cue parsing. Render the four-preset example and inspect a contact sheet and GIF.
