# Agent skill + Remotion demo

## Why
Agents install capabilities with `npx skills add <owner>/<repo>` (skills.sh convention). Shipping SKILL.md files in the tcut repo makes any coding agent instantly good at tcut, and a tcut × Remotion skill + demo shows the flagship use case: real, reproducible terminal footage inside a motion-designed launch video.

## What changes
- `skills/tcut/SKILL.md` — full tcut workflow for agents (record, t API, config, render-again, CI, gotchas)
- `skills/tcut-remotion/SKILL.md` — pipeline for composing tcut MP4s in Remotion
- Demo project `~/dev/test/promo` (not in repo): Remotion composition over two tcut clips → promo.mp4 (28s)
- README + website + llms.txt mention `npx skills add AmanVarshney01/tcut`
