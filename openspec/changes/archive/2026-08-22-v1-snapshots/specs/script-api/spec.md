## ADDED Requirements
### Requirement: Snapshots
`t.snapshot(path)` SHALL record a still-capture mark at the current moment. When the recording renders, each mark SHALL produce a still image: `.svg` paths as a static vector frame with selectable text, any other extension as a pixel-perfect raster written by the WebView pass. `t.screenshot` SHALL remain as an alias. Marks SHALL survive cast-layer editing (cut, concat, chapter selection) like other markers.

#### Scenario: png and svg stills from one script
- **WHEN** a script calls `t.snapshot("hero.png")` and `t.snapshot("hero.svg")`
- **THEN** rendering writes both files, each showing the terminal at its mark's instant, and reports them in `screenshots`

#### Scenario: capture includes the output that precedes the mark
- **WHEN** output is recorded immediately before a mark within the same frame tick
- **THEN** the captured still includes that output (same batch semantics as the raster renderer)
