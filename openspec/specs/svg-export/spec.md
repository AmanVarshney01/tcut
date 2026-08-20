# svg-export Specification

## Purpose
TBD - created by archiving change tcut-m3-exporters-and-test. Update Purpose after archive.
## Requirements
### Requirement: Animated SVG from the cell grid
A `.svg` output SHALL be produced without Bun.WebView or ffmpeg by replaying the cast into a headless core on the visible timeline, snapshotting the grid at each frame, de-duplicating identical consecutive grids, and emitting one `<g>` per unique frame animated with CSS `@keyframes` + `steps()` timing. The SVG SHALL loop, honour theme colours, bold/italic/underline/inverse attributes, wide characters, padding, margin, border radius and the window bar, and draw the cursor block.

#### Scenario: svg output
- **WHEN** `output: "demo.svg"` is rendered
- **THEN** a well-formed SVG is written whose `<style>` contains an animation lasting the visible duration

#### Scenario: dedupe
- **WHEN** the cast contains a 5 s idle period
- **THEN** that period is represented by a single frame group with a 5 s hold

### Requirement: SVG geometry
Cell width SHALL be `fontSize × 0.6` and cell height `fontSize × lineHeight` unless `svg.cellWidth` is given; text SHALL be positioned per run with `x` offsets so alignment does not depend on font metrics.

#### Scenario: fixed cell width
- **WHEN** `font.size` is 20
- **THEN** column 10 starts at x = padding + 120

