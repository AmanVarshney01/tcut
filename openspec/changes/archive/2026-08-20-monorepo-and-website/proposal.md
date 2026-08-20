## Why

tcut needs a public face beyond the README, and adding a website to a single-package repo means a proper
workspace layout first. The user asked for Astro via `create-better-t-stack`.

## What Changes

- Repo becomes a Bun-workspaces + Turborepo monorepo: `packages/tcut` (the `termcut` npm package, bin `tcut`,
  unchanged API), `packages/config` (shared tsconfig), `apps/web` (Astro site).
- `apps/web`: static Astro 7 + Tailwind 4 site scaffolded with `create-better-t-stack`, then designed: live demo
  (the animated SVG tcut produced), film-strip of real frames showing `hide()` cuts, script ↔ output, feature
  summary, VHS comparison, requirements, install. Deployed to GitHub Pages by a workflow.
- CI / release workflows updated for the new paths; a Pages workflow added.
- Root README becomes a short monorepo overview; the full docs live in `packages/tcut/README.md` (what npm shows).

## Capabilities

### New Capabilities
- `website`: the marketing/docs site and its deployment.

### Modified Capabilities
- `distribution`: monorepo paths for CI, release and npm publishing.

## Impact

Everything moves; `packages/tcut` source is unchanged. Workflows, root `package.json`, `turbo.json`, new `apps/web`.
