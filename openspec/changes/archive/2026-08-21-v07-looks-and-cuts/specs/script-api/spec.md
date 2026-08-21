## ADDED Requirements
### Requirement: timelapse
`t.timelapse(fn, { speed })` SHALL run `fn` while recording a speed segment so that its output plays back `speed`× faster (default 8); segments nest and restore the outer speed.
#### Scenario: install timelapse
- **WHEN** `await t.timelapse(() => t.run("bun install"), { speed: 8 })` takes 16 s to record
- **THEN** it plays in 2 s
### Requirement: look config
`defineVideo` config SHALL accept `shadow` (boolean or `{ x, y, blur, color, opacity }`), `watermark` (text or `{ text | image, position, opacity, size, color, margin }`) and `marginFill: "transparent"`.
#### Scenario: defaults
- **WHEN** `shadow: true` with no `margin`
- **THEN** the resolved config has `margin: 40`
