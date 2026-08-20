# website Specification

## Purpose
TBD - created by archiving change monorepo-and-website. Update Purpose after archive.
## Requirements
### Requirement: Static Astro site
`apps/web` SHALL be an Astro site with static output (`astro build` → `dist/`), styled with Tailwind 4, buildable with `bun run build` from the repo root via Turborepo. It SHALL NOT require a server, environment variables or external services to build.

#### Scenario: build
- **WHEN** `bun run build` runs at the repo root on a fresh clone after `bun install`
- **THEN** `apps/web/dist/index.html` exists

### Requirement: Content made by tcut
The landing page SHALL embed real tcut output — the animated SVG and frame images rendered from the repository's own demo cast — alongside the exact script that produced them. It SHALL cover: what tcut is, install commands (`bunx termcut`, `bun add -g termcut`, binary), the record/render model, output formats, `tcut test`, a comparison with VHS, and system requirements, linking to GitHub, npm and the full README.

#### Scenario: demo is real output
- **WHEN** the hero renders
- **THEN** it displays `docs/demo.svg` (or a copy of it) produced by `examples/readme.ts`, not a mock-up

### Requirement: Quality floor
The site SHALL be responsive down to 360 px, keep visible keyboard focus, respect `prefers-reduced-motion` (pausing the SVG animation), and use self-hosted fonts.

#### Scenario: reduced motion
- **WHEN** the OS reduced-motion preference is on
- **THEN** the hero SVG shows a single still frame

### Requirement: Deployment
The website SHALL be deployed to Cloudflare Workers as static assets by an Alchemy stack in `packages/infra` (`bun run deploy:prod` → stage `production`). A GitHub Actions workflow SHALL deploy on pushes to `main` that touch the site or infra when Cloudflare credentials are configured as secrets, and SHALL skip cleanly otherwise. The Astro `site` SHALL be the public Workers URL and `base` SHALL be `/`.

#### Scenario: deploy on push
- **WHEN** `main` is pushed with Cloudflare secrets configured
- **THEN** the production stage is updated and the site is reachable at the Workers URL

#### Scenario: no credentials
- **WHEN** the secrets are absent
- **THEN** the workflow reports the skip and exits successfully

