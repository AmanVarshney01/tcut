## Design

The CLI executes the script during preparation, then caches a rendered source and frame-aligned clips. The local server exposes only its session boot document, compiled UI assets, prepared media and note persistence. No screen-capture permissions, take uploads, encoder jobs or live project endpoints exist in this player.

The frontend uses React, TanStack Router, Vite and Tailwind, matching the website. Scene selection cues paused footage. Space plays/pauses or advances after the current scene holds; arrows navigate; R replays. Playback speed persists across clips, and out-of-range navigation is a no-op. Two stacked video players preload the next scene while keeping the current frame visible. A load-generation guard protects rapid scene selection; media errors provide retry guidance.

The viewport contains the whole workspace. Fullscreen uses the stage alone, so notes and scene navigation are not recorded. Its transport disappears after pointer inactivity. The right notes panel is optional and saves edits per scene through a serialized queue. API origin checks and confined source-file routes remain.

The example creates a temporary TypeScript project, captures a real Neovim edit adding API rate limiting, runs tests and curl requests, and records a local browser result. Resources are disposed before presentation playback starts. This demonstrates automatic code-edit footage without pretending to automate desktop IDEs. Users record delivery with their preferred screen recorder.

Scale review uses independent 1× and 2× renders from identical source/layout, displayed at the same CSS dimensions. Browser screenshot content retains its capture resolution; scale improves rendering density of the composition and terminal typography.
