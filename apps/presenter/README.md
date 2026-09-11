# Simple presentation player

React + TanStack Router + Vite + Tailwind, matching the website. Bun serves prepared scene clips and editable notes. Capture video, webcam and narration with your screen recorder.

From the repository root:

```sh
bun packages/tcut/src/cli.ts present packages/tcut/examples/presentation.video.ts --open
# Optional frontend development, using the printed URL:
TCUT_PRESENT_URL=http://127.0.0.1:PORT/SESSION/ bun run --cwd apps/presenter dev
```

Space plays/pauses, then advances after a scene holds. Arrows navigate, R replays, F enters fullscreen, and N opens notes on the right. Fullscreen controls disappear after pointer inactivity. The sample scripts a Neovim edit that adds rate limiting to a Bun API, runs tests and curl requests, and shows a browser result; those processes exist only during preparation.

Vite produces presenter.js and presenter.css; the CLI embeds both for offline use. The served API only reads prepared media and saves notes. There is no live shell, camera/microphone capture, take manager or export workflow.
