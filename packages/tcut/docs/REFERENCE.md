# tcut reference

Full options for the CLI and the script API. For getting started see the [README](../README.md).

## CLI

```
tcut <script.ts>                  record + render
tcut rec [-- command…]            record a live session, then render
tcut record <script.ts>           record only (.cast)
tcut render <file.cast>           render a cast (tcut's or asciinema's)
tcut test <paths…>                run scripts as tests
tcut diff <a.cast> <b.cast> [--at s] [--images dir]   compare screen text of two recordings; exit 1 if different
tcut cut <file.cast> --from 2s --to 10s [--chapters a,b] [--cast out.cast] [-o …]   keep part of a recording (a new .cast, plus outputs if -o)
tcut concat <a.cast> <b.cast…> [--gap 500ms] [--cast out.cast] [-o …]   join recordings of the same size end to end
tcut publish <files…> [--open]    upload to your S3-compatible bucket, print links
tcut publish --setup              configure endpoint/bucket/keys (~/.config/tcut/publish.json)
tcut init [name] [--template basic|tour|test]
tcut themes

-o, --output <path>   repeatable: .mp4 .webm .gif .webp .svg .html .png .jpg .txt (final screen as text) or a directory/
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

## Script reference

`defineVideo(config, async (t) => { … })`

**Config** (all optional except `output`)

| | default | |
|---|---|---|
| `output` | — | string or array; extension picks the format |
| `shell` | `"bash"` | `bash` · `zsh` · `fish` · `sh` · or a `string[]` command |
| `prompt` | `"> "` | prompt of the clean shell; `run()` waits for it |
| `cols` · `rows` · `fps` | 80 · 24 · 60 | |
| `width` · `height` | — | video size in px; grid is derived and centred inside |
| `loopOffset` | — | where GIF/WebP loops start: frames or `"50%"` |
| `maxPause` | — | idle compression at render time: gaps between events longer than this are shortened to this (`"800ms"`) |
| `keys` | — | `true` or `{ position: "bottom" \| "top", ttl: "1.2s", merge: "350ms", limit: 1, font: px, color, background, radius }`: key presses as chips; one at a time by default (`limit: 3` keeps a short history), style is yours to override |
| `preset` | — | `readme` (80×20, gif-friendly) · `x` (1280×720) · `youtube` (1920×1080, 60 fps) · `square` (1080×1080); explicit settings win |
| `browser` | — | record a real browser window (Bun.WebView) with the terminal: `{ url?, width?, height?, fps?, title?, position?: "right" \| "left" \| "top" \| "bottom" \| "overlay", offset?: { x, y } }`. Frames are stored beside the cast (`<name>.browser/`) and composited in mp4/gif/png output; svg/html show the terminal only |
| `typingSpeed` · `typingJitter` · `seed` | `"50ms"` · 0 · 1 | jitter is seeded, so it's reproducible |
| `theme` | `"catppuccin-mocha"` | any bundled theme name (~600, loose matching) or a full theme object |
| `font` | JetBrains Mono 20 px | `{ family, size, lineHeight, letterSpacing }` |
| `windowBar` · `title` · `padding` · `margin` · `marginFill` · `borderRadius` | `"none"` · `""` · 24 · 0 · bg · 0 | window chrome. `marginFill: "transparent"` gives real alpha in PNG/WebP/GIF/WebM/SVG/HTML (MP4/JPEG use the theme background) |
| `shadow` | — | `true` or `{ x: 0, y: 18, blur: 50, color: "#000000", opacity: 0.45 }`: drop shadow under the window(s), also in SVG. Sets `margin` to 40 unless you set one |
| `watermark` | — | `"© text"` or `{ text \| image: "logo.png", position: "bottom-right" \| "top-left" \| … \| "center", opacity: 0.6, size: 14 (text px) \| 28 (image height px), color, margin: 16 }`; drawn over the picture in every format |
| `cursor` | `{ blink: true, period: 1000 }` | |
| `playbackSpeed` · `waitTimeout` · `endPause` | 1 · `"15s"` · `"1s"` | |
| `cache` · `quantize` · `core` | true · false · `"ghostty"` | skip re-recording when unchanged · frame-grid timestamps · emulator |

**`t`**

- Type: `run(cmd)` · `type(text)` · `paste(text)` · `enter()` `tab()` `backspace()` `escape()` `space()` `up()` `down()` `left()` `right()` `home()` `end()` `pageUp()` `pageDown()` (all take a count) · `ctrl("c")` · `alt("b")` · `shift("tab")` · `scrollUp(n)` `scrollDown(n)` (mouse wheel; needs a program with mouse tracking) · `key("f5")` · `raw(bytes)`
- Wait: `sleep("500ms")` · `wait(/re/, { scope: "line" | "screen" })` — default waits for the prompt
- Assert: `expect(/re/)` — throws with a screen dump
- Shape the video: `hide(async () => …)` cuts a section · `screenshot("x.png")` · `marker("name")` · `resize(cols, rows)` · `clear()`
- Zoom: `zoom({ rows: [a, b], cols: [a, b], duration: "400ms", padding: 1 })` magnifies a region (animated on the render clock); `zoom(null)` resets.
- Chapters: `chapter("name")` writes mp4 chapter metadata (`ffprobe -show_chapters`), appears in `--json`, and is a cut point: `--chapters Zoom,Intro` renders only those (in that order), `--split-chapters` writes one file per chapter (`demo-01-intro.mp4`, …).
- Timelapse: `timelapse(async () => { await t.run("bun install") }, { speed: 8 })` plays everything inside 8× faster — `maxPause` only squeezes silence, this squeezes output too. Nests.
- Captions: `print(markdown)` renders Markdown to ANSI (via @wterm/markdown) straight into the recording, not the shell: headings, bold, lists, code, links. `title(text, { pause })` is a heading + rule + pause. Use at a prompt, not inside a TUI.
- Look: `screen()` · `line()` · `cursor()` · `cols` · `rows`
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

## Requirements

| To… | You need |
|---|---|
| run tcut | Bun ≥ 1.4, or the standalone binary |
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

## How it works, briefly

`Bun.Terminal` runs your shell in a PTY. Output is timestamped into the cast and also fed to a headless
[Ghostty](https://ghostty.org) terminal (via [wterm](https://github.com/vercel-labs/wterm)), which is how `run()` knows the prompt is back and
`expect()` sees what you see. Rendering replays the cast into that terminal inside `Bun.WebView` one frame at a time and hands the
frames to ffmpeg; SVG and HTML are built straight from the terminal grid. Inspired by [VHS](https://github.com/charmbracelet/vhs).
