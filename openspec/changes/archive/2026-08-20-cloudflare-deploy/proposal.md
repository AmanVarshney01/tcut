## Why

The site was first published to GitHub Pages; the user wants it on Cloudflare via better-t-stack's Cloudflare
option, which uses Alchemy.

## What Changes

- `packages/infra`: Alchemy stack (`Cloudflare.Website.StaticSite`) building `apps/web` and deploying it as a
  static-assets Worker; root scripts `deploy` / `deploy:prod` / `destroy`.
- Astro `base` back to `/`, `SITE` = the Workers URL. GitHub Pages workflow and site removed.
- `deploy.yml`: deploys on pushes to `main` when `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` secrets exist.

## Capabilities

### New Capabilities
- none

### Modified Capabilities
- `website`: deployment target and workflow.

## Impact

`packages/infra/*`, `apps/web/astro.config.mjs`, root `package.json`/`turbo.json`, workflows, README.
