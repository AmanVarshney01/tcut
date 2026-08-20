## Context

Bun runs TypeScript directly, so the npm package can ship source. `bun build --compile` cross-compiles for all
supported targets from one macOS runner (verified locally for linux-x64).

## Goals / Non-Goals

**Goals:** one tag → GitHub Release with binaries (+ npm when credentials exist); honest requirements docs.
**Non-Goals:** Homebrew tap, code signing/notarization, Linux/Windows runtime verification.

## Decisions

- **Ship TS source on npm** (`files: src, scripts`), no build output: simplest, and Bun is the only supported runtime.
  `prepare` is dropped — dependents never run it and the runtime `Bun.build` fallback covers them.
- **npm publish is optional in CI**, gated on `secrets.NPM_TOKEN`, so releases never fail for lack of credentials.
  The first publish can also be done locally with `npm login && bun publish --access public`.
- **Version check** in the release job prevents tagging the wrong commit.
- **Binaries named `tcut-<version>-<platform>[.exe]`** with a `SHA256SUMS` file, matching common CLI release layouts.

## Risks / Trade-offs

- [Cross-compiled Linux/Windows binaries untested at runtime] → stated in README; CI smoke-tests only macOS.
- [~65–85 MB binaries] → acceptable; it's an embedded Bun runtime + WebKit-free renderer assets.
