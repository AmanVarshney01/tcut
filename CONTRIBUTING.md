# Contributing

Bun workspace + Turborepo.

| Path | What |
|---|---|
| `packages/tcut` | the CLI + library, published to npm as `termcut` (bin `tcut`) |
| `apps/web` | the website (Astro, static) — https://tcut.amanv.dev |
| `packages/infra` | Alchemy stack deploying the website to Cloudflare |
| `packages/config` | shared TypeScript config |
| `openspec/` | specs and change history ([OpenSpec](https://github.com/Fission-AI/OpenSpec)) — new work starts with `openspec new change <name>` |
| `PLAN.md` | roadmap and the measurements behind the design |

```sh
bun install
bun run typecheck            # all packages
bun run test                 # tcut tests — spawn real shells + WebView, so macOS
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
