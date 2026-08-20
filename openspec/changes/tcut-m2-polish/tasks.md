## 1. Config and types

- [x] 1.1 Add `core`, `quantize` to `VideoConfig`/`ResolvedConfig`; defaults and override merging
- [x] 1.2 CLI flags: `--margin-fill`, `--line-height`, `--letter-spacing`, `--cast`, `--record-only`, `--core`

## 2. Recorder

- [x] 2.1 `Screen.create` loads Ghostty or lite core per config
- [x] 2.2 Quantize timestamps when enabled; test that times sit on the frame grid

## 3. Renderer

- [x] 3.1 Page boots the selected core; skip OSC injection for lite
- [x] 3.2 Fixed-frame resize behaviour; test with a synthetic resize cast
- [x] 3.3 Encoder tests: mp4, webm, gif, webp, PNG dir from a synthetic cast

## 4. Verify

- [x] 4.1 `bun test`, `bunx tsc --noEmit`, demo renders with `--core lite`
