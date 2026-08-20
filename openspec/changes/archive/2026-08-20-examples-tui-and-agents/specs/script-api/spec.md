## ADDED Requirements

### Requirement: Screen-driven navigation
Scripts SHALL be able to drive interactive TUIs by combining `wait(pattern, { scope: "screen" })`, key helpers and `screen()` reads in ordinary control flow (e.g. press `up` until the highlighted row matches), with `expect()` asserting the final selection.

#### Scenario: select a menu entry by label
- **WHEN** a script loops `t.up()` until `t.screen()` matches `/●\s+Cloudflare/` and then presses Enter
- **THEN** the scaffolder's config records `"webDeploy": "cloudflare"` regardless of the option order
