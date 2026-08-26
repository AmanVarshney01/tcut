import React, { type CSSProperties } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  OffthreadVideo,
  Sequence,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { AMBER, ASSET_BASE, BG, BLUE, DIM, FG, GREEN, MAUVE, MONO, MUTED, PEACH } from "./theme";

/** Clip/asset URL. ASSET_BASE is "" for the Remotion project and "promo/" when the same composition runs on the website. */
const asset = (p: string) => staticFile(`${ASSET_BASE}${p}`);

// ───────────────────────────── timeline ─────────────────────────────
const SCENES = [
  ["open", 105],
  ["code", 315],
  ["themes", 200],
  ["look", 230],
  ["browser", 240],
  ["claude", 180],
  ["captions", 180],
  ["zoom", 150],
  ["tuis", 170],
  ["formats", 190],
  ["ci", 200],
  ["agents", 240],
  ["end", 160],
] as const;
type SceneName = (typeof SCENES)[number][0];
const START = new Map<SceneName, number>();
const LEN = new Map<SceneName, number>();
let acc = 0;
for (const [name, len] of SCENES) {
  START.set(name, acc);
  LEN.set(name, len);
  acc += len;
}
export const PROMO_DURATION = acc;
const startOf = (name: SceneName): number => START.get(name) ?? 0;
const lenOf = (name: SceneName): number => LEN.get(name) ?? 0;

// ───────────────────────────── helpers ─────────────────────────────
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const useSpring = (delay = 0, config: { damping?: number; stiffness?: number; mass?: number } = { damping: 200 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config, durationInFrames: 40 });
};

/** Fades the whole scene in/out so cuts never feel hard. */
const Scene: React.FC<{ children: React.ReactNode; inFrames?: number; outFrames?: number }> = ({ children, inFrames = 8, outFrames = 12 }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const opacity =
    interpolate(frame, [0, inFrames], [0, 1], clamp) * interpolate(frame, [durationInFrames - outFrames, durationInFrames], [1, 0], clamp);
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
};

const Backdrop: React.FC = () => <AbsoluteFill style={{ background: BG }} />;

const Progress: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: `${(frame / PROMO_DURATION) * 100}%`, background: AMBER, opacity: 0.9 }} />
  );
};

/** A floating window card. `inset` crops a margin that was baked into the source clip. */
const Card: React.FC<{
  width: number;
  videoW: number;
  videoH: number;
  inset?: number;
  delay?: number;
  rotate?: number;
  style?: CSSProperties;
  children: React.ReactNode;
}> = ({ width, videoW, videoH, inset = 0, delay = 0, rotate = 0, style, children }) => {
  const s = useSpring(delay, { damping: 18, stiffness: 120, mass: 0.9 });
  const innerW = videoW - inset * 2;
  const innerH = videoH - inset * 2;
  const height = (width * innerH) / innerW;
  const scale = videoW / innerW;
  const mediaW = width * scale;
  const mediaH = (mediaW * videoH) / videoW;
  return (
    <div
      style={{
        width,
        height,
        borderRadius: 20,
        overflow: "hidden",
        position: "relative",
        boxShadow: "0 40px 110px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.09)",
        opacity: s,
        transform: `translateY(${(1 - s) * 70}px) scale(${0.9 + 0.1 * s}) rotate(${rotate}deg)`,
        background: "#1e1e2e",
        flexShrink: 0,
        ...style,
      }}
    >
      <div style={{ position: "absolute", left: (width - mediaW) / 2, top: (height - mediaH) / 2, width: mediaW, height: mediaH }}>{children}</div>
    </div>
  );
};

const Video: React.FC<{ src: string; startFrom?: number; endAt?: number }> = ({ src, startFrom, endAt }) => (
  <OffthreadVideo src={asset(src)} startFrom={startFrom} endAt={endAt} muted style={{ width: "100%", height: "100%", display: "block" }} />
);

const Words: React.FC<{ text: string; delay?: number; size?: number; color?: string; weight?: number; step?: number }> = ({
  text,
  delay = 0,
  size = 82,
  color = FG,
  weight = 800,
  step = 4,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ fontFamily: MONO, fontSize: size, fontWeight: weight, color, letterSpacing: "-0.035em", lineHeight: 1.05, display: "flex", flexWrap: "wrap", gap: "0 0.3em" }}>
      {text.split(" ").map((w, i) => {
        const s = spring({ frame: frame - delay - i * step, fps, config: { damping: 16, stiffness: 140 }, durationInFrames: 36 });
        return (
          <span key={i} style={{ display: "inline-block", opacity: s, transform: `translateY(${(1 - s) * 40}px)` }}>
            {w}
          </span>
        );
      })}
    </div>
  );
};

const Sub: React.FC<{ children: React.ReactNode; delay?: number; size?: number }> = ({ children, delay = 10, size = 30 }) => {
  const s = useSpring(delay);
  return (
    <div style={{ fontFamily: MONO, fontSize: size, color: MUTED, lineHeight: 1.45, marginTop: 22, opacity: s, transform: `translateY(${(1 - s) * 20}px)` }}>{children}</div>
  );
};

const Tag: React.FC<{ children: React.ReactNode; delay?: number; color?: string; size?: number }> = ({ children, delay = 18, color = AMBER, size = 24 }) => {
  const s = useSpring(delay, { damping: 14, stiffness: 150 });
  return (
    <div
      style={{
        display: "inline-block",
        fontFamily: MONO,
        fontSize: size,
        color,
        padding: "12px 20px",
        borderRadius: 12,
        border: `1px solid ${color}55`,
        background: `${color}14`,
        marginTop: 30,
        opacity: s,
        transform: `scale(${0.9 + 0.1 * s})`,
        transformOrigin: "left center",
        whiteSpace: "pre",
        lineHeight: 1.5,
      }}
    >
      {children}
    </div>
  );
};

const Index: React.FC<{ n: number }> = ({ n }) => (
  <div style={{ position: "absolute", top: 54, right: 80, fontFamily: MONO, fontSize: 22, color: DIM, letterSpacing: "0.1em" }}>
    {String(n).padStart(2, "0")} / {String(SCENES.length - 2).padStart(2, "0")}
  </div>
);

/** Text column + clip card, alternating sides. */
const Split: React.FC<{ n: number; side: "left" | "right"; text: React.ReactNode; card: React.ReactNode }> = ({ n, side, text, card }) => (
  <Scene>
    <Index n={n} />
    <AbsoluteFill style={{ flexDirection: side === "right" ? "row" : "row-reverse", alignItems: "center", padding: "0 90px", gap: 70 }}>
      <div style={{ width: 640, flexShrink: 0 }}>{text}</div>
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center" }}>{card}</div>
    </AbsoluteFill>
  </Scene>
);

// ───────────────────────────── syntax highlighting ─────────────────────────────
const TOKEN = /(\/\/.*$)|("(?:[^"\\]|\\.)*")|(\b(?:import|from|export|default|async|await|null)\b)|(\b\d+(?:\.\d+)?\b)|(\bt\.\w+)|(\w+)|(\s+)|(.)/g;
const Code: React.FC<{ line: string }> = ({ line }) => {
  const out: React.ReactNode[] = [];
  let m: RegExpExecArray | null;
  let i = 0;
  TOKEN.lastIndex = 0;
  while ((m = TOKEN.exec(line))) {
    const [txt, comment, str, kw, num, method] = m;
    const color = comment ? DIM : str ? GREEN : kw ? MAUVE : num ? PEACH : method ? BLUE : /^[{}()[\],;:=>]+$/.test(txt) ? MUTED : FG;
    out.push(
      <span key={i++} style={{ color }}>
        {txt}
      </span>,
    );
    if (txt.length === 0) TOKEN.lastIndex++;
  }
  return <>{out}</>;
};

// ───────────────────────────── scenes ─────────────────────────────
const Cursor: React.FC<{ color?: string }> = ({ color = AMBER }) => {
  const frame = useCurrentFrame();
  return <span style={{ display: "inline-block", width: "0.6em", height: "1em", background: color, verticalAlign: "-0.12em", marginLeft: 4, opacity: frame % 20 < 12 ? 1 : 0 }} />;
};

const Typed: React.FC<{ text: string; from: number; cps?: number; size?: number; color?: string; prompt?: boolean }> = ({ text, from, cps = 2.2, size = 40, color = FG, prompt = true }) => {
  const frame = useCurrentFrame();
  const n = Math.max(0, Math.min(text.length, Math.floor((frame - from) * cps)));
  return (
    <div style={{ fontFamily: MONO, fontSize: size, color, whiteSpace: "pre", opacity: frame >= from ? 1 : 0 }}>
      {prompt ? <span style={{ color: MUTED }}>$ </span> : null}
      {text.slice(0, n)}
      <Cursor />
    </div>
  );
};

const Open: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cmdUp = interpolate(frame, [40, 52], [0, 1], { ...clamp, easing: Easing.inOut(Easing.cubic) });
  const logo = spring({ frame: frame - 46, fps, config: { damping: 11, stiffness: 110, mass: 0.8 }, durationInFrames: 45 });
  const tag = spring({ frame: frame - 66, fps, config: { damping: 200 }, durationInFrames: 30 });
  const chips = spring({ frame: frame - 80, fps, config: { damping: 200 }, durationInFrames: 30 });
  return (
    <Scene outFrames={10}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "absolute", transform: `translateY(${-cmdUp * 260}px) scale(${1 - cmdUp * 0.45})`, opacity: 1 - cmdUp * 0.65 }}>
          <Typed text="tcut promo.video.ts" from={6} cps={1.1} size={46} />
        </div>
        <div style={{ fontFamily: MONO, fontSize: 260, fontWeight: 800, color: FG, letterSpacing: "-0.06em", lineHeight: 1, opacity: logo, transform: `scale(${0.6 + 0.4 * logo})` }}>
          tcut
        </div>
        <div style={{ fontFamily: MONO, fontSize: 44, color: FG, opacity: tag * 0.85, transform: `translateY(${(1 - tag) * 20}px)`, marginTop: 14, letterSpacing: "-0.01em" }}>
          Terminal videos, <span style={{ color: AMBER }}>as code</span>.
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 40, opacity: chips, transform: `translateY(${(1 - chips) * 16}px)` }}>
          {["TypeScript", "Bun 1.4", "mp4 · gif · svg · html", "605 themes"].map((c) => (
            <div key={c} style={{ fontFamily: MONO, fontSize: 22, color: MUTED, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 999, padding: "8px 18px" }}>
              {c}
            </div>
          ))}
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const HERO_LINES = [
  'import { defineVideo } from "tcut";',
  "",
  "export default defineVideo(",
  '  { theme: "Catppuccin Mocha", cols: 80, rows: 22 },',
  "  async (t) => {",
  '    await t.run("bun --version");',
  '    await t.run("eza --tree --icons");',
  '    await t.title("Hello from tcut");',
  "    await t.zoom({ rows: [0, 7], cols: [0, 48] });",
  '    await t.sleep("1.6s");',
  "    await t.zoom(null);",
  "  },",
  ");",
];
// Chapter marks from `ffprobe -show_chapters out/hero.mp4` → which script line is executing at clip time t.
const HERO_MARKS: Array<[number, number]> = [
  [0, 5],
  [1.0, 6],
  [3.016, 7],
  [4.925, 8],
  [5.35, 9],
  [6.527, 10],
  [7.928, -1],
];
const HERO_CLIP_AT = 34;
const HERO_FRAMES = 269;

const CodeToVideo: React.FC = () => {
  const frame = useCurrentFrame();
  const clipT = Math.max(0, frame - HERO_CLIP_AT) / 30;
  let active = -1;
  for (const [at, line] of HERO_MARKS) if (clipT >= at) active = line;
  if (frame < HERO_CLIP_AT) active = -1;
  const panel = useSpring(4, { damping: 18, stiffness: 120 });
  return (
    <Scene>
      <Index n={1} />
      <div style={{ position: "absolute", left: 90, top: 70, width: 1700 }}>
        <Words text="Script it." size={76} />
        <Sub delay={8} size={28}>
          One <span style={{ color: FG }}>.video.ts</span> file is the whole recording. Every keystroke, pause and zoom is code — diffable, re-runnable, deterministic.
        </Sub>
      </div>
      <div style={{ position: "absolute", left: 90, right: 90, top: 300, bottom: 70, display: "flex", gap: 50, alignItems: "center" }}>
        <div
          style={{
            width: 860,
            flexShrink: 0,
            borderRadius: 20,
            background: "rgba(20,20,32,0.9)",
            boxShadow: "0 40px 110px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.09)",
            padding: "26px 0",
            opacity: panel,
            transform: `translateY(${(1 - panel) * 60}px)`,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 28px 18px", borderBottom: "1px solid rgba(255,255,255,0.07)", marginBottom: 14 }}>
            {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
              <div key={c} style={{ width: 13, height: 13, borderRadius: 99, background: c }} />
            ))}
            <div style={{ fontFamily: MONO, fontSize: 20, color: MUTED, marginLeft: 14 }}>hero.video.ts</div>
          </div>
          {HERO_LINES.map((line, i) => {
            const appear = interpolate(frame, [i * 2, i * 2 + 6], [0, 1], clamp);
            const isActive = i === active;
            const past = active >= 0 && i < active && i >= 5;
            const future = active >= 0 && i > active && i >= 5 && i <= 10;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  fontFamily: MONO,
                  fontSize: 25,
                  lineHeight: "42px",
                  whiteSpace: "pre",
                  opacity: appear * (future ? 0.42 : past ? 0.7 : 1),
                  background: isActive ? "rgba(249,226,175,0.13)" : "transparent",
                  boxShadow: isActive ? `inset 5px 0 0 ${AMBER}` : "none",
                  transform: `translateX(${(1 - appear) * -14}px)`,
                }}
              >
                <span style={{ width: 74, textAlign: "right", paddingRight: 26, color: isActive ? AMBER : DIM, flexShrink: 0 }}>{i + 1}</span>
                <Code line={line} />
                {isActive ? <span style={{ marginLeft: "auto", paddingRight: 22, color: AMBER, fontSize: 20 }}>▶ running</span> : null}
              </div>
            );
          })}
        </div>
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <Card width={830} videoW={1476} videoH={864} delay={18}>
            <Sequence from={HERO_CLIP_AT} durationInFrames={HERO_FRAMES} layout="none">
              <Video src="hero.mp4" />
            </Sequence>
          </Card>
        </div>
      </div>
    </Scene>
  );
};

const THEMES: Array<[string, string]> = [
  ["catppuccin-mocha", "hero.mp4"],
  ["dracula", "themes/dracula.mp4"],
  ["nord", "themes/nord.mp4"],
  ["gruvbox-dark", "themes/gruvbox-dark.mp4"],
  ["rose-pine", "themes/rose-pine.mp4"],
  ["tokyo-night", "themes/tokyo-night.mp4"],
  ["github-light-default", "themes/github-light-default.mp4"],
  ["synthwave-everything", "themes/synthwave-everything.mp4"],
  ["kanagawa-wave", "themes/kanagawa-wave.mp4"],
];
const THEME_EVERY = 22;

const Themes: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const idx = Math.min(THEMES.length - 1, Math.floor(frame / THEME_EVERY));
  const [name, src] = THEMES[idx];
  const pop = spring({ frame: frame - idx * THEME_EVERY, fps, config: { damping: 12, stiffness: 200 }, durationInFrames: 20 });
  return (
    <Scene>
      <Index n={2} />
      <div style={{ position: "absolute", left: 90, top: 70, display: "flex", alignItems: "flex-end", gap: 40 }}>
        <Words text="Record once." size={76} />
        <Words text="605 themes." size={76} color={MAUVE} delay={10} />
      </div>
      <div style={{ position: "absolute", left: 90, top: 160, width: 1500 }}>
        <Sub delay={12} size={28}>
          The cast is the source of truth. Re-render it in any Ghostty theme, size or font — no re-recording.
        </Sub>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 290, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <Card width={1150} videoW={1476} videoH={864} delay={6}>
          <Sequence durationInFrames={lenOf("themes")} layout="none">
            <Video src={src} startFrom={30} />
          </Sequence>
        </Card>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, bottom: 40, display: "flex", justifyContent: "center", alignItems: "center", gap: 24 }}>
        <div style={{ fontFamily: MONO, fontSize: 26, color: MUTED }}>$ tcut render hero.cast --theme</div>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            fontWeight: 700,
            color: BG,
            background: AMBER,
            borderRadius: 12,
            padding: "8px 22px",
            transform: `scale(${0.85 + 0.15 * pop})`,
            boxShadow: "0 10px 40px rgba(249,226,175,0.35)",
          }}
        >
          {name}
        </div>
      </div>
    </Scene>
  );
};

const CardLabel: React.FC<{ children: React.ReactNode; delay?: number }> = ({ children, delay = 12 }) => {
  const s = useSpring(delay);
  return <div style={{ fontFamily: MONO, fontSize: 22, color: MUTED, marginTop: 14, textAlign: "center", opacity: s }}>{children}</div>;
};

const Look: React.FC = () => (
  <Scene>
    <Index n={3} />
    <AbsoluteFill style={{ flexDirection: "row-reverse", alignItems: "center", padding: "0 90px", gap: 70 }}>
      <div style={{ width: 640, flexShrink: 0 }}>
        <Words text="It records your look." />
        <Sub>
          <span style={{ color: FG }}>tcut rec</span> asks the terminal itself for its colours, font and size — and ships the same Nerd Font symbols Ghostty embeds, so the icons always render. Same session, twice:
        </Sub>
        <Tag color={AMBER}>{'theme: "auto" · font: "auto"'}</Tag>
      </div>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
        <div>
          <Card width={1060} videoW={2136} videoH={552} delay={6}>
            <Sequence durationInFrames={lenOf("look")} layout="none">
              <Video src="look-before.mp4" />
            </Sequence>
          </Card>
          <CardLabel delay={14}>before — the default theme</CardLabel>
        </div>
        <div>
          <Card width={1060} videoW={2136} videoH={552} delay={20}>
            <Sequence durationInFrames={lenOf("look")} layout="none">
              <Video src="look-after.mp4" />
            </Sequence>
          </Card>
          <CardLabel delay={28}>after — your Ghostty — real colours, font and icons</CardLabel>
        </div>
      </div>
    </AbsoluteFill>
  </Scene>
);

const Tuis: React.FC = () => (
  <Scene>
    <Index n={8} />
    <div style={{ position: "absolute", left: 0, right: 0, top: 70, display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
      <Words text="Drive any TUI." size={76} />
      <div style={{ width: 1400 }}>
        <Sub delay={8} size={28}>
          Read the screen, press the keys, wait for the right text. lazygit · fzf · yazi · nvim · Claude Code · Codex · yours.
        </Sub>
      </div>
    </div>
    <div style={{ position: "absolute", left: 110, top: 420 }}>
      <Card width={640} videoW={1536} videoH={948} inset={24} delay={6} rotate={-4}>
        <Sequence durationInFrames={lenOf("tuis")} layout="none">
          <Video src="lazygit.mp4" startFrom={95} />
        </Sequence>
      </Card>
    </div>
    <div style={{ position: "absolute", right: 110, top: 420 }}>
      <Card width={640} videoW={1536} videoH={900} inset={24} delay={22} rotate={4}>
        <Sequence durationInFrames={lenOf("tuis")} layout="none">
          <Video src="yazi.mp4" startFrom={80} />
        </Sequence>
      </Card>
    </div>
    <div style={{ position: "absolute", left: 560, top: 340 }}>
      <Card width={800} videoW={1416} videoH={852} inset={24} delay={14} style={{ boxShadow: "0 50px 140px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.12)" }}>
        <Sequence durationInFrames={lenOf("tuis")} layout="none">
          <Video src="fzf.mp4" startFrom={240} />
        </Sequence>
      </Card>
    </div>
  </Scene>
);

const FORMATS: Array<[string, string, string]> = [
  [".mp4", "276 KB", AMBER],
  [".gif", "660 KB", PEACH],
  [".webm", "244 KB", GREEN],
  [".svg", "20 KB", MAUVE],
  [".html", "80 KB", BLUE],
  [".png", "60 KB", FG],
];

const Formats: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const R = 370;
  return (
    <Scene>
      <Index n={9} />
      <div style={{ position: "absolute", left: 90, top: 70, width: 760 }}>
        <Words text="One cast." size={76} />
        <Words text="Every format." size={76} color={AMBER} delay={8} />
        <Sub delay={14} size={28}>
          Animated SVG for the README, a single-file HTML player, GIF/WebP for the PR, MP4 with chapters for YouTube, stills for docs.
        </Sub>
        <Tag delay={26} color={GREEN}>
          $ tcut publish demo.mp4 {"→"} your own S3 bucket
        </Tag>
      </div>
      <div style={{ position: "absolute", left: 960, top: 110, width: 860, height: 860 }}>
        <div style={{ position: "absolute", left: 430, top: 430, transform: "translate(-50%,-50%)" }}>
          <Card width={520} videoW={1476} videoH={864} delay={4}>
            <Img src={asset("hero.png")} style={{ width: "100%", height: "100%", display: "block" }} />
          </Card>
        </div>
        {FORMATS.map(([ext, size, color], i) => {
          const s = spring({ frame: frame - 16 - i * 6, fps, config: { damping: 13, stiffness: 130 }, durationInFrames: 40 });
          const a = -Math.PI / 2 + (i / FORMATS.length) * Math.PI * 2 + frame * 0.0035;
          const x = 430 + Math.cos(a) * R * s;
          const y = 430 + Math.sin(a) * (R * 0.72) * s;
          return (
            <div
              key={ext}
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: `translate(-50%,-50%) scale(${s})`,
                opacity: s,
                fontFamily: MONO,
                background: "rgba(20,20,32,0.92)",
                border: `1px solid ${color}66`,
                boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 30px ${color}22`,
                borderRadius: 16,
                padding: "14px 24px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: 40, fontWeight: 800, color }}>{ext}</div>
              <div style={{ fontSize: 20, color: MUTED, marginTop: 2 }}>{size}</div>
            </div>
          );
        })}
      </div>
    </Scene>
  );
};

const Agents: React.FC = () => {
  const a = useSpring(0);
  const c = useSpring(60);
  const b = useSpring(124);
  return (
    <Scene>
      <Index n={11} />
      <AbsoluteFill style={{ justifyContent: "center", padding: "0 160px", gap: 64 }}>
        <div style={{ opacity: a, transform: `translateY(${(1 - a) * 30}px)` }}>
          <div style={{ fontFamily: MONO, fontSize: 28, color: MUTED, marginBottom: 16 }}>No script? Record a live session — it writes the script for you.</div>
          <Typed text="tcut rec -- lazygit" from={6} cps={1.4} size={54} />
        </div>
        <div style={{ opacity: c, transform: `translateY(${(1 - c) * 30}px)` }}>
          <div style={{ fontFamily: MONO, fontSize: 28, color: MUTED, marginBottom: 16 }}>Or skip the CLI — import {'{ defineVideo }'} from "termcut". It is a library too.</div>
          <Typed text="await defineVideo(config, script).run()" from={66} cps={1.8} size={54} color={GREEN} prompt={false} />
        </div>
        <div style={{ opacity: b, transform: `translateY(${(1 - b) * 30}px)` }}>
          <div style={{ fontFamily: MONO, fontSize: 28, color: MUTED, marginBottom: 16 }}>Using Claude Code, Codex or Cursor? Your agent already knows tcut.</div>
          <Typed text="npx skills add AmanVarshney01/tcut" from={130} cps={1.6} size={54} color={AMBER} />
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

const EndLine: React.FC<{ at: number; children: React.ReactNode; size?: number }> = ({ at, children, size = 42 }) => {
  const s = useSpring(at);
  return <div style={{ fontFamily: MONO, fontSize: size, color: FG, opacity: s, transform: `translateY(${(1 - s) * 24}px)`, marginTop: 20, whiteSpace: "pre" }}>{children}</div>;
};

const End: React.FC = () => {
  const logo = useSpring(0, { damping: 14, stiffness: 120 });
  return (
    <Scene inFrames={6} outFrames={1}>
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ fontFamily: MONO, fontSize: 200, fontWeight: 800, color: FG, letterSpacing: "-0.06em", lineHeight: 1, opacity: logo, transform: `scale(${0.8 + 0.2 * logo})` }}>
          tcut
        </div>
        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", alignItems: "center" }}>
          <EndLine at={14}>
            <span style={{ color: MUTED }}>$ </span>bun add -g termcut
          </EndLine>
          <EndLine at={30}>
            <span style={{ color: MUTED }}>$ </span>npx skills add <span style={{ color: AMBER }}>AmanVarshney01/tcut</span>
          </EndLine>
          <EndLine at={52} size={30}>
            <span style={{ color: MUTED }}>tcut.amanv.dev · MIT · this video was cut with tcut + Remotion</span>
          </EndLine>
        </div>
      </AbsoluteFill>
    </Scene>
  );
};

// ───────────────────────────── assembly ─────────────────────────────
const S: React.FC<{ name: SceneName; children: React.ReactNode }> = ({ name, children }) => (
  <Sequence from={startOf(name)} durationInFrames={lenOf(name)}>
    {children}
  </Sequence>
);

export const Promo: React.FC = () => (
  <AbsoluteFill style={{ background: BG }}>
    <Backdrop />

    <S name="open">
      <Open />
    </S>

    <S name="code">
      <CodeToVideo />
    </S>

    <S name="themes">
      <Themes />
    </S>

    <S name="look">
      <Look />
    </S>

    <S name="browser">
      <Split
        n={4}
        side="left"
        text={
          <>
            <Words text="A real browser. In the frame." />
            <Sub>Record a Bun.WebView next to the terminal — side by side or overlaid. Vite hot-reloads on :w; React state survives the click.</Sub>
            <Tag color={BLUE}>{'t.browser.goto("localhost:5173")\nt.browser.waitFor(/Hello from tcut/)'}</Tag>
          </>
        }
        card={
          <Card width={1060} videoW={1258} videoH={852} inset={24} delay={6}>
            <Sequence durationInFrames={lenOf("browser")} layout="none">
              <Video src="nvim-hmr.mp4" startFrom={204} />
            </Sequence>
          </Card>
        }
      />
    </S>

    <S name="claude">
      <Split
        n={5}
        side="right"
        text={
          <>
            <Words text="Record Claude Code." />
            <Sub>The real TUI, end to end — trust prompt, tool calls, the edit landing. Codex too. Wait on what's on screen, not on a timer.</Sub>
            <Tag color={PEACH}>{"t.wait(/✻ \\w+ for \\d+s/, { scope: \"screen\" })"}</Tag>
          </>
        }
        card={
          <Card width={1060} videoW={1280} videoH={720} inset={24} delay={6}>
            <Sequence durationInFrames={lenOf("claude")} layout="none">
              <Video src="claude-promo.mp4" startFrom={555} />
            </Sequence>
          </Card>
        }
      />
    </S>

    <S name="captions">
      <Split
        n={6}
        side="left"
        text={
          <>
            <Words text="Narrate in Markdown." />
            <Sub>Titles and captions render straight into the terminal — headings, bold, inline code — without typing a single echo.</Sub>
            <Tag color={GREEN}>{'t.title("Shipping a typo fix")\nt.print("## 2. Fix\\nREADME says *vidoes*.")'}</Tag>
          </>
        }
        card={
          <Card width={1000} videoW={1056} videoH={708} inset={24} delay={6}>
            <Sequence durationInFrames={lenOf("captions")} layout="none">
              <Video src="captions.mp4" startFrom={105} />
            </Sequence>
          </Card>
        }
      />
    </S>

    <S name="zoom">
      <Split
        n={7}
        side="right"
        text={
          <>
            <Words text="Zoom. Chapters. No dead air." />
            <Sub>Punch into a region of the grid, drop chapter marks into the MP4, and let maxPause squeeze every idle gap.</Sub>
            <Tag color={MAUVE}>{'t.zoom({ rows: [9, 19], cols: [0, 66] })\nt.chapter("Zoom")  ·  maxPause: "900ms"'}</Tag>
          </>
        }
        card={
          <Card width={1060} videoW={1280} videoH={756} inset={24} delay={6}>
            <Sequence durationInFrames={lenOf("zoom")} layout="none">
              <Video src="nvim-zoom-nokeys.mp4" startFrom={285} />
            </Sequence>
          </Card>
        }
      />
    </S>

    <S name="tuis">
      <Tuis />
    </S>

    <S name="formats">
      <Formats />
    </S>

    <S name="ci">
      <Split
        n={10}
        side="left"
        text={
          <>
            <Words text="Test it in CI." />
            <Sub>Fast mode runs the script with no video and reports TAP. diff tells you what changed on screen between two recordings — exit 1 if anything did.</Sub>
            <Tag color={GREEN}>{"$ tcut test *.video.ts\n$ tcut diff before.cast after.cast"}</Tag>
          </>
        }
        card={
          <Card width={1060} videoW={1548} videoH={864} delay={6}>
            <Sequence durationInFrames={lenOf("ci")} layout="none">
              <Video src="ci.mp4" startFrom={10} />
            </Sequence>
          </Card>
        }
      />
    </S>

    <S name="agents">
      <Agents />
    </S>

    <S name="end">
      <End />
    </S>

    <Progress />
  </AbsoluteFill>
);
