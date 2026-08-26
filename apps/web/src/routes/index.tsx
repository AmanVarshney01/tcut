import { Block, HighlightedCodeBlock, parseRoot } from "codehike/blocks";
import { createFileRoute } from "@tanstack/react-router";
import btsGif from "@/assets/examples/better-t-stack.gif";
import claudeGif from "@/assets/examples/claude-code.gif";
import lazygitGif from "@/assets/examples/lazygit.gif";
import nvimGif from "@/assets/examples/nvim-hmr.gif";
import demoSvg from "@/assets/demo.svg?raw";
import facts from "@/assets/facts.json";
import promoPoster from "@/assets/promo-poster.jpg";
import { Code } from "@/components/code";
import { CopyCommand } from "@/components/copy-command";
import { RenderSpotlight } from "@/components/spotlight";
import { ThemeToggle } from "@/components/theme-toggle";
import { Walkthrough } from "@/components/walkthrough";
import Snippets from "@/content/snippets.md";

export const Route = createFileRoute("/")({ component: Page });

const GITHUB = "https://github.com/AmanVarshney01/tcut";
const NPM = "https://www.npmjs.com/package/termcut";
const REFERENCE = `${GITHUB}/blob/main/packages/tcut/docs/REFERENCE.md`;
const EXAMPLES = `${GITHUB}/tree/main/packages/tcut/examples`;

const SnippetSchema = Block.extend({ rec: HighlightedCodeBlock, test: HighlightedCodeBlock, browser: HighlightedCodeBlock, vhs: HighlightedCodeBlock });

const api = [
  ["run()", "waits for your prompt to come back, not for a timer"],
  ["expect()", "asserts on the screen, including lines that already scrolled away"],
  ["hide()", "runs setup off-camera; the state stays"],
  ["snapshot()", "a PNG or SVG still of that exact moment, on every render"],
  ["chapter()", "mp4 chapters, and cut points for --chapters / --split-chapters"],
  ["print()", "Markdown captions rendered into the terminal, nothing typed"],
  ["zoom()", "magnifies a region; keys: true shows what was pressed"],
  ["timelapse()", "fast-forwards an install or a build, not just the silence"],
  ["browser", "a real browser window beside or over the terminal"],
  ["tcut test", "runs every script as a test: no delays, just the assertions"],
] as const;

const faithful = [
  "Arrow keys and pastes arrive exactly as the running program asked: application cursor mode, bracketed paste.",
  "Links printed with OSC 8 stay clickable in SVG and HTML.",
  "Frames are never torn: synchronized-output blocks are captured whole.",
  "Symbols the font lacks — progress blocks, Nerd Font icons — stay on their cell, so status bars never drift.",
  "tcut doctor demo.cast explains what a recording used, and what would not survive a GIF.",
];

const examples = [
  { src: btsGif, alt: "bun create better-t-stack answered with arrow keys", label: "bun create better-t-stack, driven with arrow keys" },
  { src: claudeGif, alt: "Claude Code's interactive TUI editing a file", label: "Claude Code, the interactive TUI, end to end" },
  { src: lazygitGif, alt: "lazygit navigated with the keyboard", label: "lazygit" },
  { src: nvimGif, alt: "Neovim editing App.tsx with a browser window overlaid showing the page update", label: "nvim + a real browser window, Vite HMR" },
];

const steps = [
  ["Record.", "Bun.Terminal runs your shell in a PTY. Every byte is timestamped into a .cast."],
  ["Watch.", "The same bytes feed a headless Ghostty (via wterm). That is how run() knows the prompt is back and expect() sees what you see."],
  ["Render.", "The cast replays into the same terminal inside Bun.WebView, one frame per tick, straight to ffmpeg. SVG and HTML are built from the terminal grid, no browser involved."],
] as const;

function Page() {
  const snippets = parseRoot(Snippets, SnippetSchema);
  return (
    <div className="mx-auto max-w-[62rem] px-5 py-10 sm:py-14">
      <header className="flex items-center justify-between">
        <a href="/" className="font-mono text-lg font-medium no-underline" aria-label="tcut home">tcut</a>
        <nav className="flex items-center gap-5 font-mono text-sm text-ink-2" aria-label="Primary">
          <a className="no-underline hover:text-ink" href={GITHUB}>GitHub</a>
          <a className="no-underline hover:text-ink" href={NPM}>npm</a>
          <a className="no-underline hover:text-ink" href={REFERENCE}>Reference</a>
          <ThemeToggle />
        </nav>
      </header>

      <main>
        <section className="mt-16 max-w-[46rem] sm:mt-20">
          <h1 className="text-[2rem] leading-[1.15] sm:text-[2.5rem]">Terminal videos,<br />written in TypeScript</h1>
          <p className="prose-measure mt-5 text-[1.05rem] text-ink-2">Record a session live, or script it. Render it to MP4, GIF, WebM, SVG or HTML. Same recording, same pixels, every time.</p>
          <div className="mt-7 max-w-[28rem]"><CopyCommand command="bun add -g termcut" /></div>
          <p className="mt-2.5 text-sm text-ink-3">Bun ≥ 1.4. ffmpeg for MP4/GIF; SVG and HTML need nothing else. Or a <a href={`${GITHUB}/releases`}>standalone binary</a>.</p>
        </section>

        <figure className="mt-10">
          <video className="block w-full rounded-lg bg-desk-2" src="/promo.mp4" poster={promoPoster} width={1920} height={1080} controls muted loop playsInline preload="metadata" aria-label="tcut feature tour: scripted recording, themes, browser overlay, Claude Code, captions, zoom, CI" />
          <figcaption className="mt-2.5 font-mono text-xs text-ink-3">75 s tour. Every clip is a tcut recording, composed in <a href="https://remotion.dev">Remotion</a> — a build artifact, not a screen grab.</figcaption>
        </figure>

        <section className="section">
          <h2>Write it</h2>
          <p className="prose-measure mt-4 text-ink-2">A script is plain TypeScript that lives next to the code it shows. Scroll: each step adds a line, and the frame on the right is what that line actually produced — rendered by tcut, as text you can select.</p>
          <Walkthrough />
          <p className="mt-6 text-sm text-ink-3">Then <code>tcut demo.video.ts</code>. Every method, one line each:</p>
          <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {api.map(([term, what]) => (
              <div key={term}>
                <dt><code>{term}</code></dt>
                <dd className="mt-1 text-ink-2">{what}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-6 text-sm text-ink-3">The full surface is in the <a href={REFERENCE}>reference</a>.</p>
        </section>

        <section className="section">
          <h2>Or just record</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <div>
              <p className="text-ink-2">Your own shell opens — prompt, config, aliases. Type, exit. You get the recording and a script of what you typed, with <code>run()</code> calls that wait for your prompt. <code>-- command</code> runs through your shell too, so <code>tcut rec -- ls</code> is <em>your</em> ls.</p>
            </div>
            <Code codeblock={snippets.rec} />
          </div>
        </section>

        <section className="section">
          <h2>Render again</h2>
          <p className="prose-measure mt-4 text-ink-2">Recording and rendering are separate. A recording is an asciicast; frames are computed on a virtual clock. So a new theme, size or format never re-runs a shell, and cuts, joins and chapter splits happen on the recording — which is why they work for SVG as well as MP4.</p>
          <RenderSpotlight />
          <p className="mt-5 font-mono text-sm text-ink-3">mp4 · gif · webm · webp · svg · html · png · txt · log</p>
        </section>

        <figure className="mt-14">
          <div className="demo-svg overflow-hidden rounded-lg" dangerouslySetInnerHTML={{ __html: demoSvg }} />
          <figcaption className="mt-2.5 font-mono text-xs text-ink-3">demo.svg, {Math.round(facts.svgBytes / 1024)} KB. Real text, not pixels: select it, copy it. tcut recording tcut, {facts.totalFrames} frames, {facts.uniqueFrames} unique.</figcaption>
        </figure>

        <section className="section">
          <h2>Faithful to the terminal</h2>
          <p className="prose-measure mt-4 text-ink-2">The emulator is Ghostty's core, so what tcut sees is what your terminal would show — and what it records is what the program actually received.</p>
          <ul className="bullets mt-5 max-w-[46rem] text-ink-2">{faithful.map((line) => <li key={line}>{line}</li>)}</ul>
        </section>

        <section className="section">
          <h2>Test it</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <p className="text-ink-2"><code>expect()</code> makes a demo a test. <code>tcut test</code> runs it with no delays and exits non-zero when the screen does not match, so the script that renders your README video can guard it in CI. <code>tcut diff</code> catches output changes between two recordings.</p>
            <Code codeblock={snippets.test} />
          </div>
        </section>

        <section className="section">
          <h2>A browser next to the terminal</h2>
          <div className="mt-6 grid gap-8 md:grid-cols-2">
            <p className="text-ink-2">For dev-server demos: the page is recorded on the same clock and composited beside or over the terminal. <code>t.focus("browser")</code> brings it to the front.</p>
            <Code codeblock={snippets.browser} />
          </div>
        </section>

        <section className="section">
          <h2>Examples</h2>
          <p className="prose-measure mt-4 text-ink-2">tcut waits on the rendered screen, so it can drive anything a person can: menus, prompts, agents that think for ten seconds. Scripts in <a href={EXAMPLES}>examples/</a>.</p>
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            {examples.map((e) => (
              <figure key={e.label}>
                <img src={e.src} alt={e.alt} loading="lazy" className="block aspect-[16/10] w-full rounded-lg object-cover object-top" />
                <figcaption className="mt-2 font-mono text-xs text-ink-3">{e.label}</figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="section">
          <h2>Compared with VHS</h2>
          <p className="prose-measure mt-4 text-ink-2"><a href="https://github.com/charmbracelet/vhs">VHS</a> is the reference point and the inspiration. A `.tape` is a fixed script with sleeps, recorded live in Chrome; a tcut script is TypeScript that watches the screen. The notes say where that matters:</p>
          <div className="mt-5"><Code codeblock={snippets.vhs} handlers={["callout", "mark"]} /></div>
          <ul className="bullets mt-5 max-w-[46rem] text-ink-2">
            <li>Rendering never re-runs the shell — a new theme, size or format is computed from the recording. VHS screenshots Chrome live, so output depends on machine speed.</li>
            <li>Same emulator as your terminal — Ghostty's core in WASM, its themes, plus SVG and HTML outputs that need no ffmpeg or browser.</li>
          </ul>
        </section>

        <section className="section">
          <h2>How it works</h2>
          <ol className="mt-5 max-w-[46rem] list-none space-y-4 p-0 text-ink-2">
            {steps.map(([head, body]) => (
              <li key={head}><b className="text-ink">{head}</b> {body}</li>
            ))}
          </ol>
          <p className="prose-measure mt-6 text-ink-2">Built for agents as much as people: no prompts, exit codes, <code>--json</code>, an <a href="/llms.txt">llms.txt</a>. <code>npx skills add AmanVarshney01/tcut</code> teaches any coding agent tcut, plus a <code>tcut-remotion</code> skill for cutting the footage into a launch video.</p>
        </section>
      </main>

      <footer className="mt-20 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5 font-mono text-xs text-ink-3">
        <span>tcut · MIT</span>
        <span className="flex gap-4">
          <a className="no-underline hover:text-ink" href={GITHUB}>GitHub</a>
          <a className="no-underline hover:text-ink" href={NPM}>npm</a>
          <a className="no-underline hover:text-ink" href={REFERENCE}>Reference</a>
          <a className="no-underline hover:text-ink" href="/llms.txt">llms.txt</a>
        </span>
      </footer>
    </div>
  );
}
