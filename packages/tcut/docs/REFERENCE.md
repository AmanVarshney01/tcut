# tcut reference

Full options for the CLI and the script API. For getting started see the [README](../README.md).

## CLI

```
tcut <script.ts>                  record + render
tcut rec [-- command…]            record a live session in the shell you typed it in (your prompt, config, aliases), then render; `--clean` opens a plain `>` shell instead; `-- command` runs through your shell (aliases, functions, fish abbreviations), `--raw` runs the binary bare
tcut record <script.ts>           record only (.cast)
tcut present <script.ts|file.cast> prepare a reusable demo and serve the local presenter
tcut render <file.cast>           render a cast (tcut's or asciinema's)
tcut test <paths…>                run scripts as tests
tcut diff <a.cast> <b.cast> [--at s] [--images dir]   compare screen text of two recordings; exit 1 if different
tcut doctor <file.cast>           what the program used (alt screen, mouse, bracketed paste, app cursor keys, sync output, links, titles, Kitty graphics) and what tcut cannot show (Sixel, iTerm2 images, unknown sequences)
tcut cut <file.cast> --from 2s --to 10s [--chapters a,b] [--cast out.cast] [-o …]   keep part of a recording (a new .cast, plus outputs if -o)
tcut concat <a.cast> <b.cast…> [--gap 500ms] [--cast out.cast] [-o …]   join recordings of the same size end to end
tcut publish <files…> [--open]    upload to your S3-compatible bucket, print links
tcut publish --setup              configure endpoint/bucket/keys (~/.config/tcut/publish.json)
tcut init [name] [--template basic|tour|test]
tcut themes

-o, --output <path>   repeatable: .mp4 .webm .gif .webp .svg .html .png .jpg .txt (final screen as text) .log (whole transcript incl. scrollback) or a directory/
--theme <name>        any of ~600 names (`tcut themes [query]`), matched loosely: "Gruvbox Dark" = gruvbox-dark
--font <family>  --font-size <px>  --line-height <x>  --letter-spacing <px>
--fps <n>  --speed <x>  --padding <px>  --margin <px>  --margin-fill <color>  --radius <px>
--window-bar <none|colorful|colorfulRight|rings|ringsRight>  --title <text>  --no-blink
--core <ghostty|lite>  --cols <n>  --rows <n>  --width <px>  --height <px>  --loop-offset <n|N%>  --max-pause <dur>  --keys  --preset <name>  --cast <path>
--shadow  --watermark <text>  --watermark-image <file>  --margin-fill transparent   (looks; see config below)
--from <t> --to <t>  --chapters <a,b>  --split-chapters   (render / <script> / cut: which part of the visible timeline; times are seconds or "1.5s")
--browser <url> --browser-position <pos>   (rec: record a browser pane in a live session)  --record-only  --no-script  --force  -q
--open  --name <file>  --endpoint --bucket --access-key --secret-key --public-url --region   (publish)
```

## Presentation mode

`tcut present demo.video.ts --open` records (or reuses the recording), renders a reusable source and step clips, then serves the presenter on `127.0.0.1`. Keep the process running while presenting. No account, upload or deployment is involved. Local and unreleased.

| Flag | Behavior |
|---|---|
| `--directory <path>` | Local workspace; default `out/<script-name>.presentation` |
| `--port <n>` | Local port; default an available port |
| `--open` | Open the presenter in the default browser |
| `--prepare-only` | Prepare assets and exit; supports `--json` |
| `--title <text>` | Presentation title; also applies the usual terminal title override |
| `--typing-speed <duration>` | Recording delay per character; `0ms` is instant |
| `--typing-jitter <n>` | Seeded typing variation from 0 to 1 |
| `--force` | Rerun a script and replace its source recording; not required for another take |

Typing overrides apply to scripts; `.cast` inputs already contain their recorded typing. Normal render flags (theme, dimensions, speed, etc.) apply during preparation. Editing render settings prepares a new visual revision. Opening or replaying a cached presentation never executes its original commands.

Author steps with `await t.step(title, async () => { … }, { notes? })`. The callback executes during initial recording, returns its result and emits frame-aligned boundaries. Steps cannot nest. With explicit steps, setup outside callbacks is excluded from the walkthrough. Without steps, chapter markers define the boundaries; recordings without chapters become one step. Notes can be edited in the presenter and autosave locally. Changing the source creates a new revision with its authored notes.

The player fills the viewport without document scrolling. Each clip stops at its end and holds until advanced. Space plays/pauses/advances, ←/→ changes scenes, R replays, F toggles fullscreen, N toggles the right notes panel, and Home/End select the first/last scene. Click a scene to cue it paused. Next plays the following scene; Back cues the previous scene. Playback speed persists across scenes. In fullscreen, moving the pointer reveals controls; they disappear after inactivity. Speaker notes stay outside the fullscreen stage.

Use your screen recorder for video, webcam and microphone. This player has no capture permissions, take uploads, export jobs, live shell or project-execution endpoints. All source commands execute during preparation only. Captions and slides follow clip playback and freeze during holds.

The example adds rate limiting to a small Bun API: it opens the file in Neovim, types the limiter and wires it into the handler, runs `bun test` against the live server, shows the sixth request getting a 429 with curl, then loads the route in a recorded browser pane. Browser and editor visuals are prepared before opening the player; this is not desktop IDE automation. Neovim and curl are needed for that example (`requires` fails fast if either is missing).

Workspace layout: `presentation.json` stores current scenes and notes; `sources/<fingerprint>/` stores the prepared source, clips and posters. Library entry points: `preparePresentation(recording, resolvedConfig, { directory, title?, force?, onProgress? })` and `servePresentation(prepared, { port? })`. Library preparation's `force` rebuilds visual assets from the supplied recording; `video.record({ force: true })` rebuilds the original recording.

## Script reference

`defineVideo(config, async (t) => { … })`

**Config** (all optional except `output`)

| | default | |
|---|---|---|
| `output` | — | string or array; extension picks the format |
| `shell` | `"bash"` | `bash` · `zsh` · `fish` · `sh` (clean shells with the configured prompt) · `"user"` (the shell tcut was launched from, interactive + login, with its config) · or a `string[]` command |
| `prompt` | `"> "` | prompt of the clean shell; `run()` waits for it |
| `promptPattern` | from `prompt` | regex `run()`/`wait()` match against the cursor line; for `shell: "user"` it defaults to `[❯>$%#»➜λ]\s*$` and `tcut rec` writes the one it detected (e.g. `/❯\s*$/`) into the generated script |
| `cols` · `rows` · `fps` | 80 · 24 · 60 | |
| `width` · `height` | — | video size in px; grid is derived and centred inside |
| `loopOffset` | — | where GIF/WebP loops start: frames or `"50%"` |
| `scale` | 1 | pixel density: `2` renders the same layout at 2× the pixels — crisp on HiDPI screens and when a player scales the video up |
| `maxPause` | — | idle compression at render time: gaps between events longer than this are shortened to this (`"800ms"`) |
| `keys` | — | `true` or `{ position: "bottom" \| "top", ttl: "1.2s", merge: "350ms", limit: 1, font: px, color, background, radius }`: key presses as chips; one at a time by default (`limit: 3` keeps a short history), style is yours to override |
| `preset` | — | `readme` (80×20, gif-friendly) · `x` (1280×720) · `youtube` (1920×1080, 60 fps) · `square` (1080×1080); explicit settings win |
| `browser` | — | record a real browser window (Bun.WebView) with the terminal: `{ url?, width?, height?, fps?, title?, position?: "right" \| "left" \| "top" \| "bottom" \| "overlay", offset?: { x, y } }`. Frames are stored beside the cast (`<name>.browser/`) and composited in mp4/gif/png output; svg/html show the terminal only |
| `typingSpeed` · `typingJitter` · `seed` | `"50ms"` · 0 · 1 | jitter is seeded, so it's reproducible |
| `theme` | `"catppuccin-mocha"` | any bundled theme name (~600, loose matching), a full theme object, or `"auto"`: the colours of the terminal tcut runs in (asked from the terminal with OSC 10/11/4, else read from Ghostty / kitty / Alacritty / iTerm2 / Windows Terminal config). Resolved when recording and stored in the cast, so re-renders keep the look. `tcut rec` defaults to it in a terminal. |
| `font` | JetBrains Mono 20 px | `{ family, size, lineHeight, letterSpacing }`, or `"auto"`: the font of the terminal tcut runs in (Ghostty, kitty, Alacritty, iTerm2, Windows Terminal, VS Code configs). `tcut rec` defaults to it in a terminal. Glyphs the family lacks (Nerd Font icons, powerline symbols) fall back to its Nerd Font variant and to Symbols Nerd Font Mono, which tcut bundles — the same symbols-only font Ghostty embeds — so icons render in MP4/GIF/WebM/PNG on any machine. HTML and SVG outputs use the viewer's installed fonts. |
| `windowBar` · `title` · `padding` · `margin` · `marginFill` · `borderRadius` | `"none"` · `""` · 24 · 0 · bg · 0 | window chrome. `title: "auto"` follows the title the program sets (OSC 0/2 — vim, ssh, your own `printf '\033]0;…\a'`) in mp4/gif/png, HTML and SVG (SVG shows the last one). `marginFill: "transparent"` gives real alpha in PNG/WebP/GIF/WebM/SVG/HTML (MP4/JPEG use the theme background) |
| `shadow` | — | `true` or `{ x: 0, y: 18, blur: 50, color: "#000000", opacity: 0.45 }`: drop shadow under the window(s), also in SVG. Sets `margin` to 40 unless you set one |
| `watermark` | — | `"© text"` or `{ text \| image: "logo.png", position: "bottom-right" \| "top-left" \| … \| "center", opacity: 0.6, size: 14 (text px) \| 28 (image height px), color, margin: 16 }`; drawn over the picture in every format |
| `cursor` | `{ blink: true, period: 1000 }` | |
| `playbackSpeed` · `waitTimeout` · `endPause` | 1 · `"15s"` · `"1s"` | |
| `cache` · `quantize` · `core` | true · false · `"ghostty"` | skip re-recording when unchanged · frame-grid timestamps · emulator |
| `requires` | `[]` | programs the script needs on the PATH, e.g. `["bun", "eza"]`; checked before the shell starts, so a missing tool fails in milliseconds with a clear message (also in `tcut test` and `--json`: `"type": "MissingRequirementError"`) |

**`t`**

- Type: `run(cmd)` · `type(text)` · `paste(text)` · `enter()` `tab()` `backspace()` `escape()` `space()` `up()` `down()` `left()` `right()` `home()` `end()` `pageUp()` `pageDown()` (all take a count) · `ctrl("c")` · `alt("b")` · `shift("tab")` · `scrollUp(n)` `scrollDown(n)` (mouse wheel; needs a program with mouse tracking) · `key("f5")` · `raw(bytes)`
- Wait: `sleep("500ms")` · `wait(/re/, { scope: "line" | "screen" | "scrollback" })` — default waits for the prompt; `scrollback` also searches lines that scrolled off
- Assert: `expect(/re/)` — throws with a screen dump; `expect(/re/, { scope: "scrollback" })` for output that is no longer visible
- Glyphs stay on the grid: symbols the font lacks (progress-bar blocks, Nerd Font icons) are pinned to their cell in MP4/GIF/HTML and positioned per glyph in SVG, so a status bar never shifts when an animation swaps them.
- Fidelity: arrows/home/end switch to the SS3 form when the program turned on application cursor mode (vim, less, fzf); `paste()` uses bracketed paste when the program enabled it (readline, zsh, editors), so autoindent doesn't stair-step; Markdown links in `print()` captions become real OSC 8 hyperlinks
- Shape the video: `hide(async () => …)` cuts a section · `snapshot("x.png")` · `marker("name")` · `resize(cols, rows)` · `clear()`
- Zoom: `zoom({ rows: [a, b], cols: [a, b], duration: "400ms", padding: 1 })` magnifies a region (animated on the render clock); `zoom(null)` resets.
- Snapshots: `snapshot("hero.png")` / `snapshot("hero.svg")` save a still of that exact moment when the video renders — `.png` pixel-perfect through the WebView (transparency-aware), `.svg` headlessly with selectable text. Written on every render (`tcut render old.cast` included), even when no video output is configured, so one script keeps the video and its screenshots in sync. `screenshot()` is the pre-1.0 alias.
- Transition cards: `slide("Deploy to the cloud", { eyebrow: "3", subtitle: "…", duration: "2s", fade: "400ms" })` covers the terminal with a large centred heading, drawn at render time in real typography (not terminal cells) and faded in and out. It records a chapter of the same name (`chapter: false` opts out), so `--split-chapters` gives one clip per section. `during: async () => { … }` runs setup — `cd`, `clear`, start a server — behind the card while it is up, and the card holds until that finishes, so the next demo begins on a clean screen. Use it to phase between feature demos in one video; `title()` remains the small terminal-native caption.
- Chapters: `chapter("name")` writes mp4 chapter metadata (`ffprobe -show_chapters`), appears in `--json`, and is a cut point: `--chapters Zoom,Intro` renders only those (in that order), `--split-chapters` writes one file per chapter (`demo-01-intro.mp4`, …).
- Timelapse: `timelapse(async () => { await t.run("bun install") }, { speed: 8 })` plays everything inside 8× faster — `maxPause` only squeezes silence, this squeezes output too. Nests.
- Subtitle overlays: `await t.caption(text, options?)` shows text over the terminal window and returns immediately; commands continue beneath it. `t.caption(null)` clears it. Omit `duration` to keep it until replacement, clearing, or video end. A supplied duration (milliseconds or `"3s"`) expires on the recording clock, transformed with playback speed, timelapse, hide, and `maxPause`; it never extends the recording. Use `t.sleep()` when you want a caption-only hold. Captions do not enter the PTY, `screen()`, `.txt`, or `.log` output.
  - `style`: `"classic"` (default, white text on a translucent dark box), `"tiktok"` (bold outlined text with lime word highlighting), `"pop"` (yellow outlined text with a short bouncing entrance), `"minimal"` (smaller white text and shadow).
  - `position`: `"bottom"` (default) or `"top"`, inside the terminal window. Long text wraps automatically.
  - `offset`: non-negative finite pixels from the selected edge, default 16. `position: "bottom", offset: 64` raises subtitles above player controls; `position: "top", offset: 48` moves them down from the top, below the window bar. Zero is allowed. Applies to all four styles and raster/SVG/HTML/site playback/snapshots. Offset changes require recording the updated script and rendering again; they cannot move captions already baked into an exported video.
  - `fontSize`: positive pixel size; defaults 28 classic, 40 TikTok/Pop, 24 minimal. `color`, `background`, `highlightColor`: CSS colors; `background: "transparent"` removes the box.
  - TikTok highlights whitespace-separated words evenly across the caption's visible lifetime; captions lasting to video end without an expiry or replacement advance every 350ms. This is manually supplied subtitle text, without transcription, audio alignment, SRT/VTT import, or a selectable subtitle track.
  - Raster videos, animated SVG, HTML/site playback and PNG/SVG snapshots draw the caption. SVG uses approximate font metrics for wrapping. Seeking re-evaluates the caption at the destination. Cuts retain an active caption with its remaining expiry (entrance/highlight restart at the cut), and joins clear captions at the next section.
- Terminal Markdown: `print(markdown)` renders Markdown to ANSI (via @wterm/markdown) straight into the recording, not the shell: headings, bold, lists, code, links. `title(text, { pause })` is a heading + rule + pause. Use at a prompt, not inside a TUI.
- Look: `screen()` · `line()` · `scrollback()` (everything shown so far: scrolled-off lines + screen) · `cursor()` · `cols` · `rows`
- Browser pane (when `browser` is configured): `browser.goto(url)` (waits for the page, retries while a dev server starts) · `browser.waitFor(/text/)` · `browser.click(selector)` · `browser.reload()` · `browser.evaluate(js)` · `focus("terminal" | "browser")` (overlay layout: which window is in front; recorded as a marker)

Tip for dev servers: start them with output redirected (`bun run dev </dev/null >/tmp/dev.log 2>&1 &`) so their logs don't repaint over a TUI, and detach stdin so the background job isn't stopped.

Durations accept `500`, `"500ms"`, `"1.5s"`, `"2m"`.

## Cutting and joining

Editing happens on the cast, on the *visible* timeline (after `hide()`, `playbackSpeed`, `maxPause` and timelapse), so the result renders identically in every format and is still a `.cast` you can `test`, `diff` or re-render.

```sh
tcut render demo.cast --from 2s --to 10s -o clip.gif      # render a window
tcut render demo.cast --chapters Zoom -o zoom.mp4          # one chapter
tcut render demo.cast --split-chapters -o demo.mp4         # demo-01-install.mp4, demo-02-run.mp4 …
tcut cut demo.cast --from 2s --to 10s                      # writes demo-cut.cast (same options as render)
tcut concat intro.cast demo.cast outro.cast --gap 500ms -o launch.mp4
```

`cut`/`concat` bake the timing in (the new cast's `playbackSpeed` is 1). Parts of a `concat` must share `cols`×`rows`; the screen is reset at each seam and chapters carry over. The same selection works programmatically: `renderCast(file, overrides, onProgress, { from, to, chapters, splitChapters })`, `cutRecording`, `concatRecordings`, `selectChapters`.

## Library

`import { … } from "termcut"` — the package ships its TypeScript source (`exports: "./src/index.ts"`), so it is Bun-only as a library, like the CLI.

```ts
import { defineVideo, renderCast } from "termcut";

const video = defineVideo({ output: ["demo.mp4", "demo.gif"] }, async (t) => {
  await t.run("bun --version");
  await t.expect(/1\.\d+/);
  await t.snapshot("version.svg");
});

const result = await video.run({ force: true, log: console.log });
// result.outputs, result.screenshots, result.durationSeconds, result.recording

const recording = await video.record();                 // just the .cast
await video.render(recording, { overrides: { theme: "Gruvbox Dark" }, clip: { from: 2, to: 10 } });

await renderCast("old.cast", { output: ["old.webm"], width: 1280, height: 720 });   // any cast, no shell
```

| group | exports |
|---|---|
| define and run | `defineVideo(config, script)` → `Video` with `record(opts)`, `render(recording?, { overrides, clip })`, `run(opts)`; `renderCast(file, overrides, onProgress?, clip?)`; `isVideo`, `castConfig` |
| record | `recordLive(config, { command, stdin, stdout, cols, rows })`; errors `WaitTimeoutError`, `ExpectationError`, `MissingRequirementError` |
| casts | `readCast` / `writeCast` / `parseCast` / `serializeCast`; `buildTimeline` (the visible timeline) |
| edit | `cutRecording`, `concatRecordings`, `selectChapters`, `chapterRanges`, `findChapters`, `flattenRecording` |
| render | `renderOutputs`, `renderSelection`, `buildSvg`, `buildHtml`, `writeTxt`, `writeLog`, `replayFrames` (grid frames, no pixels), `decodePng` / `encodePng` / `matte` |
| inspect | `diffCasts`, `diagnoseCast` / `diagnoseRecording` / `formatDoctorReport`, `generateScript` / `eventsToOps` / `tokenize`, `runScriptTests` / `discoverScripts` |
| config | `resolveConfig`, `presets` / `applyPreset`, `themes` / `themeNames` / `resolveTheme` / `findThemes` |
| publish | `publishFiles`, `loadPublishConfig` / `savePublishConfig`, `publicUrlFor` |
| types | `export type *` — `VideoConfig`, `ResolvedConfig`, `Recording`, `Session`, `RenderResult`, … |

`theme: "auto"` / `font: "auto"` read the terminal the process runs in; in CI they fall back to the defaults with a note, so pass explicit values there. Render one video at a time — each render drives a WebView.

## Requirements

| To… | You need |
|---|---|
| run tcut | Bun ≥ 1.4.1, or the standalone binary |
| record (`rec`, scripts, `test`) | a shell — nothing else |
| render `.svg` / `.html` | nothing else |
| render `.png` / `frames/` | macOS: nothing (built-in WebKit) · Linux / Windows: Chrome, Chromium, Edge or Brave |
| render `.mp4` / `.gif` / `.webm` | the above + ffmpeg |
| render `.webp` | ffmpeg with libwebp (`brew install ffmpeg-full`; found automatically) |

macOS renders with the system WebKit. **Linux** renders through a headless Chrome/Chromium found on the PATH (or `BUN_CHROME_PATH=/path/to/chrome`); SVG, HTML and TXT output need no browser. Running as root (Docker, CI) automatically adds `--no-sandbox`. **Windows** records through ConPTY (Git Bash or any shell) and renders through Chrome the same way; one ConPTY limitation: `t.resize()` changes the recorded grid but the running shell is not told (no SIGWINCH), so resize-aware programs keep their old size. macOS, Linux and Windows binaries are all exercised by CI on every push. The recorded shell gets an installed UTF-8 locale (your `LANG` if it is one, else `C.UTF-8`), so emoji and non-ASCII input work on minimal images.

Transparent output renders every changed frame twice (over the theme background and over a contrasting one) and mattes the pair into RGBA, so it is slower than opaque output; MP4 cannot carry alpha and falls back to the theme background.

## Agents

```sh
npx skills add AmanVarshney01/tcut
```

Installs two skills: `tcut` (recording terminal videos) and `tcut-remotion` (composing tcut clips into
motion-designed launch videos with [Remotion](https://remotion.dev)). Every command also takes `--json`
(one JSON document on stdout, `{ "error" }` on failure) and never prompts; [llms.txt](https://tcut.amanv.dev/llms.txt)
is the condensed reference.

## Rendering fidelity

- **Hyperlinks**: OSC 8 links (from programs, or Markdown links in captions) are clickable in the HTML player and the SVG (`<a href>` around the text).
- **Synchronized output** (mode 2026): while a program is mid-repaint, the previous complete frame is held (bounded to half a second), so TUIs that use it never show torn frames.
- `.log` output writes the whole transcript — scrollback then the final screen — for docs or assertions.

## How it works, briefly

`Bun.Terminal` runs your shell in a PTY. Output is timestamped into the cast and also fed to a headless
[Ghostty](https://ghostty.org) terminal (via [wterm](https://github.com/vercel-labs/wterm)), which is how `run()` knows the prompt is back and
`expect()` sees what you see. Rendering replays the cast into that terminal inside `Bun.WebView` one frame at a time and hands the
frames to ffmpeg; SVG and HTML are built straight from the terminal grid. Inspired by [VHS](https://github.com/charmbracelet/vhs).
