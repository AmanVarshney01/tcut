## 1. Monorepo

- [x] 1.1 Move CLI to `packages/tcut`; root workspace `package.json` + `turbo.json`; `bun install` resolves; tests/typecheck/build pass from root
- [x] 1.2 Update `ci.yml`, `release.yml` paths; add `pages.yml`
- [x] 1.3 Root README (overview) + package README (full docs)

## 2. Website

- [x] 2.1 Astro static config (`site`/`base` for Pages, no node adapter, no env schema); fonts self-hosted
- [x] 2.2 Generate site media from the demo cast (SVG inline, frame strip PNGs)
- [x] 2.3 Build the landing page (hero, strip, script ↔ output, features, VHS table, requirements, install, footer)
- [x] 2.4 Screenshot review at desktop + mobile widths; reduced-motion check

## 3. Ship

- [x] 3.1 Enable GitHub Pages (Actions source), push, deployment green, URL verified
