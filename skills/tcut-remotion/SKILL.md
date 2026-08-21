---
name: tcut-remotion
description: Combine tcut terminal recordings with Remotion to produce polished, motion-designed launch/promo videos (title cards, animated captions, layered terminal footage). Use when the user wants a product video, launch video, or social video that features terminal/CLI footage.
---

# tcut × Remotion — launch videos with real terminal footage

tcut produces pixel-perfect terminal clips; Remotion composes them in React with springs, typography, and layout. Together: a full motion-designed launch video where the terminal footage is real, reproducible, and re-renderable.

Install both skills first: `npx skills add AmanVarshney01/tcut remotion-dev/skills`.

## Pipeline

1. **Record the footage with tcut** (see the `tcut` skill). For clips destined for Remotion:
   - `fps: 30` to match the Remotion composition; `margin: 0, borderRadius: 0` and let React draw the card (rounded corners, shadow). Keep `windowBar: "colorful"` — the traffic lights read as "a real terminal"
   - For a 1920×1080 composition record with `--font-size 30` (≈1480 px wide for 80 cols) so clips are never upscaled
   - `maxPause: "1s"` keeps clips tight; add `keys: true` only if the audience needs to see keystrokes
   - Output MP4 (H.264) — Remotion's `<OffthreadVideo>` reads it frame-accurately
   - Drop `t.chapter("name")` before each step: chapters land in the MP4 and `ffprobe -show_chapters -print_format json clip.mp4` gives exact timestamps you can use to sync overlays (e.g. highlight the script line that is executing — the strongest "code → video" shot)
   - Re-render one cast in several themes — `tcut render hero.cast --theme nord -o themes/nord.mp4` — and swap the `<OffthreadVideo src>` by frame: same timeline, theme flips live

2. **Scaffold Remotion**: `bun create video` (choose blank), or add `remotion`, `@remotion/cli`, `react`, `react-dom` to a project with a `registerRoot`.

3. **Compose**: copy the tcut MP4s into `public/`, then frame them:

```tsx
import { AbsoluteFill, OffthreadVideo, staticFile, spring, useCurrentFrame, useVideoConfig } from "remotion";

const Clip: React.FC<{ src: string; caption: string }> = ({ src, caption }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  return (
    <AbsoluteFill style={{ background: "#11111b", justifyContent: "center", alignItems: "center" }}>
      <div style={{ transform: `scale(${0.92 + 0.08 * enter})`, borderRadius: 16, overflow: "hidden", boxShadow: "0 30px 80px rgba(0,0,0,.6)" }}>
        <OffthreadVideo src={staticFile(src)} style={{ width: 1060 }} muted />
      </div>
      <h2 style={{ color: "#cdd6f4", fontFamily: "ui-monospace, monospace", fontSize: 38, marginTop: 26, opacity: enter }}>{caption}</h2>
    </AbsoluteFill>
  );
};
```

   Sequence scenes with `<Sequence from={...} durationInFrames={...}>`; time scene lengths to each clip's real duration (`ffprobe -show_entries format=duration`). Trim with `startFrom`/`endAt` (frames).

   Clips recorded with a `margin` baked in can be cropped by scaling the video by `videoW / (videoW - 2 * margin)` inside an `overflow: hidden` card.

4. **Render**: `bunx remotion render <CompositionId> out/promo.mp4 --crf 15 --image-format png` for a high-quality master (PNG intermediates, near-lossless H.264). Match composition `fps` to the tcut clips to avoid resampling; check layout first with `bunx remotion still <Id> still.png --frame N` for one frame per scene.

## Design notes that make it look pro

- Terminal clips are crisp text: never scale above 100%; scale down slightly (~85–95%) inside a framed card instead
- Reuse the terminal theme's palette for backgrounds/captions (Catppuccin Mocha bg `#11111b`, fg `#cdd6f4`) so footage and motion design feel like one piece
- Title card: type-on monospace headline (slice the string by frame) reads as "terminal-native"
- End card: the install command in a copy-paste-looking block beats a logo
- One idea per scene, a big mono headline plus the one line of tcut API that does it; cut on the moment something appears in the clip. A feature tour can run ~70 s; a social cut should stay under 30 s

## Why this combo

The terminal footage is a build artifact, not a screen grab: change the tcut script or theme, re-run, and the promo re-renders with `bunx remotion render` — a fully reproducible launch-video pipeline in TypeScript end to end.
