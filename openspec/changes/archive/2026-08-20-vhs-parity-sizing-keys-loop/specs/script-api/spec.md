## ADDED Requirements
### Requirement: Shift and scroll input
`t.shift(key, times?)` SHALL send Shift+Tab (`ESC [ Z`), shifted cursor/navigation keys (CSI `1;2` / `;2~` forms) and uppercase letters. `t.scrollUp(n)` / `t.scrollDown(n)` SHALL send SGR mouse-wheel events at the cursor when the program has enabled mouse tracking, and otherwise do nothing but log why.
#### Scenario: shift tab
- **WHEN** `t.shift("tab")` is called
- **THEN** `\x1b[Z` is written to the PTY
#### Scenario: scroll without mouse tracking
- **WHEN** `t.scrollDown()` is called at a plain shell prompt
- **THEN** nothing is written and the log explains that mouse tracking is off
### Requirement: Pixel sizing
`width`/`height` SHALL size the video in pixels. When `cols`/`rows` are not given they SHALL be derived from the font metrics so the grid fits; the rendered output SHALL be exactly `width × height` (rounded to even) with the terminal centred inside the frame.
#### Scenario: 1280×720
- **WHEN** `width: 1280, height: 720` and no cols/rows
- **THEN** the mp4 is 1280×720 and the terminal grid fits inside it
