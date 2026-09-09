# Transition slides between feature demos

## Why
Sam asked for it: "I would like to (in tcut) be able to inject transition slides that are like large headings … Want something to phase between feature demos in a single video." He emulated one with `print()`/`title()`, which renders inside the terminal grid — small, left-aligned, and, in his words, ugly.

A section break in a feature tour is a design element, not terminal output. It should be drawn at render time in real typography, like the key overlay and the zoom already are.

## What changes
- `t.slide(heading, opts)` records a `slide:` marker; the recorder holds the clock for its duration.
- Options: `subtitle`, `eyebrow`, `duration` (default 2s), `fade` (default 400ms), `chapter` (default true — the card names a chapter, so `--split-chapters` yields one clip per section), and `during`, which runs setup (`cd`, `clear`, start a server) invisibly behind the card and stretches it to cover that work.
- All three renderers draw the card: the raster path (mp4/gif/webm/png) with a per-frame fade, the animated SVG with steps cut at the card's boundaries, and the HTML player from data.
- `title()` stays as the small terminal-native caption.
