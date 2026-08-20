## ADDED Requirements

### Requirement: Light and dark themes
The site SHALL provide light and dark themes driven by one token set, SHALL default to the OS `prefers-color-scheme`, SHALL offer a header toggle whose choice persists in `localStorage`, and SHALL apply the theme before first paint.

#### Scenario: OS dark, no choice
- **WHEN** the OS prefers dark and no choice is saved
- **THEN** the page renders dark on first paint

#### Scenario: toggle persists
- **WHEN** the visitor switches to light and reloads
- **THEN** the page renders light regardless of the OS setting
