## ADDED Requirements
### Requirement: Window shadow
When `shadow` is set, the compositor SHALL draw a drop shadow under the terminal (and browser) window in raster output and an equivalent `feDropShadow` filter in SVG; `margin` SHALL default to 40 so the shadow has room.
#### Scenario: shadow in svg
- **WHEN** `shadow: true` and the output is `.svg`
- **THEN** the window rect carries `filter="url(#shadow)"`
### Requirement: Transparent background
When `marginFill` is `"transparent"`, outputs whose format carries alpha (PNG, WebP, GIF, WebM, SVG, HTML) SHALL have a transparent margin; MP4 and JPEG SHALL use the theme background and the result SHALL say so in `notes`.
#### Scenario: transparent png
- **WHEN** a cast renders to `.png` with a transparent margin and a shadow
- **THEN** margin corners have alpha 0, the window interior alpha 255, and the shadow region an alpha strictly between
### Requirement: Watermark
When `watermark` is set, text or an image SHALL be drawn over the picture at the configured corner (or centre) with the configured opacity and size, in raster, SVG and HTML output.
#### Scenario: text watermark
- **WHEN** `watermark: "© me"`
- **THEN** every frame shows "© me" bottom-right
### Requirement: Text output
An output ending in `.txt` SHALL contain the final screen as plain text, one row per line, trailing blanks removed.
#### Scenario: txt
- **WHEN** the recording ends showing "> one" and "> two"
- **THEN** the file is "> one\n> two\n"
### Requirement: Clip selection
Rendering SHALL accept `from`/`to` (seconds on the visible timeline), `chapters` (titles or 1-based numbers, joined in the order given) and `splitChapters` (one output per chapter, suffixed `-NN-slug`). Selection is performed on the cast, so every output format supports it.
#### Scenario: split chapters
- **WHEN** a cast has chapters "Install" and "Run" and renders `demo.mp4` with `splitChapters`
- **THEN** `demo-01-install.mp4` and `demo-02-run.mp4` are written
### Requirement: Timelapse segments
A `speed:N` marker SHALL make the events that follow play N× faster on the visible timeline until the next `speed:` marker; `t.timelapse(fn, { speed })` records such a pair around `fn`.
#### Scenario: eight times
- **WHEN** 2 s of output happen inside `timelapse(fn, { speed: 4 })`
- **THEN** they occupy 0.5 s of video
