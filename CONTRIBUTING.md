# Contributing

Bun workspace + Turborepo.

| Path | What |
|---|---|
| `packages/tcut` | the CLI + library, published to npm as `termcut` (bin `tcut`) |
| `apps/web` | the website (React + Vite, prerendered) — https://tcut.amanv.dev |
| `apps/presenter` | local React/Vite player for prerecorded scenes |
| `apps/promo` | the Remotion promo video |
| `packages/infra` | Alchemy stack deploying the website to Cloudflare |
| `packages/config` | shared TypeScript config |
| `openspec/` | specs and change history ([OpenSpec](https://github.com/Fission-AI/OpenSpec)) — new work starts with `openspec new change <name>` |
| `PLAN.md` | roadmap and the measurements behind the design |

```sh
bun install
bun run lint                 # lint, including warnings
bun run typecheck            # CLI, website, infrastructure and promo
bun run test                 # CLI + website tests; real shells, WebView/Chrome and ffmpeg
bun run build                # tcut binary + website
bun run demo                 # record + render packages/tcut/examples/demo.ts
bun run media                # regenerate the website's demo media with tcut itself
bun run dev:web              # website dev server
bun run deploy:prod          # deploy the website (Alchemy → Cloudflare)
bun run sync:readme          # copy the root README into packages/tcut (npm shows that one)
```

Releasing: bump `version` in `packages/tcut/package.json`, run `bun run sync:readme`, commit, `git tag vX.Y.Z && git push --tags`.
The release workflow builds binaries for every platform and publishes to npm via trusted publishing (OIDC — no token).

The root `README.md` is the product README and the single source of truth; `packages/tcut/README.md` is a copy.

Dependency maintenance: `bun outdated -r` checks every workspace. Zod stays on 3.x because Code Hike 1.1 exposes Zod 3 schemas. Keep the Effect packages on the same release-candidate version, and the Remotion packages on the same exact version. After updates, run lint, typecheck, tests and build. CI uses the Bun version pinned in the root package manifest.
