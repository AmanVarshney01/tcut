---
name: tcut-remotion
description: Combine tcut terminal recordings with Remotion to produce polished, motion-designed launch/promo videos (title cards, animated captions, layered terminal footage). Use when the user wants a product video, launch video, or social video that features terminal/CLI footage.
---

# tcut × Remotion — launch videos with real terminal footage

tcut produces pixel-perfect terminal clips; Remotion composes them in React with springs, typography, and layout. Together: a full motion-designed launch video where the terminal footage is real, reproducible, and re-renderable.

Install both skills first: `npx skills add AmanVarshney01/tcut remotion-dev/skills`.

## Pipeline

1. **Record the footage with tcut** (see the `tcut` skill). For clips destined for Remotion:
   - `preset: "x"` (1280×720) or explicit `width/height`, `fps: 30` to match the Remotion composition
   - `windowBar: "none", margin: 0, borderRadius: 0` for a bare terminal you can frame in React, **or** keep tcut's window chrome and float it as-is
   - `maxPause: "1s"` and `keys: true` keep clips tight and legible
   - Output MP4 (H.264) — Remotion's `<OffthreadVideo>` reads it frame-accurately

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

4. **Render**: `bunx remotion render <CompositionId> out/promo.mp4`. Match composition `fps`/dimensions to the tcut clips to avoid resampling.

## Design notes that make it look pro

- Terminal clips are crisp text: never scale above 100%; scale down slightly (~85–95%) inside a framed card instead
- Reuse the terminal theme's palette for backgrounds/captions (Catppuccin Mocha bg `#11111b`, fg `#cdd6f4`) so footage and motion design feel like one piece
- Title card: type-on monospace headline (slice the string by frame) reads as "terminal-native"
- End card: the install command in a copy-paste-looking block beats a logo
- Keep it under 45 s; one idea per scene; cut on the moment something appears in the clip

## Why this combo

The terminal footage is a build artifact, not a screen grab: change the tcut script or theme, re-run, and the promo re-renders with `bunx remotion render` — a fully reproducible launch-video pipeline in TypeScript end to end.
