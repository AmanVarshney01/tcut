## MODIFIED Requirements

### Requirement: Deployment
The website SHALL be deployed to Cloudflare Workers as static assets by an Alchemy stack in `packages/infra` (`bun run deploy:prod` → stage `production`). A GitHub Actions workflow SHALL deploy on pushes to `main` that touch the site or infra when Cloudflare credentials are configured as secrets, and SHALL skip cleanly otherwise. The Astro `site` SHALL be the public Workers URL and `base` SHALL be `/`.

#### Scenario: deploy on push
- **WHEN** `main` is pushed with Cloudflare secrets configured
- **THEN** the production stage is updated and the site is reachable at the Workers URL

#### Scenario: no credentials
- **WHEN** the secrets are absent
- **THEN** the workflow reports the skip and exits successfully
