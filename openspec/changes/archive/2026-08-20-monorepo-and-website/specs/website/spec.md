## ADDED Requirements

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
A GitHub Actions workflow SHALL build `apps/web` and deploy it to GitHub Pages on pushes to `main`, with the Astro `site`/`base` configured for the Pages URL.

#### Scenario: deploy on push
- **WHEN** `main` is pushed
- **THEN** the Pages deployment succeeds and the site is reachable at the Pages URL
