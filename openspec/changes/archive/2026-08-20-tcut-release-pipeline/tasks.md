## 1. Package

- [x] 1.1 `LICENSE` (MIT), `package.json` metadata/files/engines, drop `prepare`
- [x] 1.2 `bun publish --dry-run` shows only src/scripts/README/LICENSE

## 2. Release automation

- [x] 2.1 `scripts/build-binaries.ts` (5 targets + SHA256SUMS)
- [x] 2.2 `.github/workflows/release.yml` (tag check, binaries, GitHub Release, optional npm)
- [x] 2.3 Repo public; tag `v0.1.0`; release workflow green with assets attached

## 3. Docs

- [x] 3.1 README: Install (npm / binary) + Requirements matrix + badges
