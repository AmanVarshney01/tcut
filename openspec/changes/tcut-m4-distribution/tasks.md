## 1. Assets and binary

- [x] 1.1 `scripts/build-assets.ts` + `package.json` scripts (`build:assets`, `build`, `prepare`)
- [x] 1.2 `src/renderer/embedded.ts` + fallback logic in `bundle.ts`
- [x] 1.3 Build `dist/tcut`; run it from an empty temp dir against a cast

## 2. Init templates and docs

- [x] 2.1 `tcut init --template basic|tour|test`
- [x] 2.2 `examples/readme.ts` → `docs/demo.gif` + `docs/demo.svg`; README embeds them

## 3. CI and repo

- [x] 3.1 `.github/workflows/ci.yml` (macos-latest)
- [ ] 3.2 `git init`, first commit, private GitHub repo, push
