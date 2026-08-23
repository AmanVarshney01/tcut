// Cloudflare deployment for the website, managed by Alchemy (the better-t-stack Cloudflare option).
// The site is static and ships as a Worker serving content-hashed assets (Cloudflare.Website.StaticSite),
// with apps/web/src/worker.ts in front for analytics proxying and content negotiation.
//   bun run deploy          → personal dev_<user> stage on workers.dev
//   bun run deploy:prod     → --stage production, served at https://tcut.amanv.dev (DNS + cert provisioned by Alchemy)
import path from "node:path";
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export const PRODUCTION_DOMAIN = "tcut.amanv.dev";

export default Alchemy.Stack(
  "tcut",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const web = yield* Cloudflare.Website.StaticSite(
      "web",
      Alchemy.Stack.useSync((stack) => ({
        cwd: "../../apps/web",
        command: "bun run build",
        outdir: "dist",
        // A small Worker in front of the assets: first-party Umami proxy, markdown content negotiation,
        // /sitemap.xml alias, markdown 404s. It runs on every request and delegates to ASSETS.
        main: path.resolve(import.meta.dir, "../../apps/web/src/worker.ts"),
        // The Worker runs only where it has a job; hashed assets and media are served by the asset layer directly.
        // Paths with no asset still reach the Worker (for the markdown 404).
        assets: { notFoundHandling: "404-page", runWorkerFirst: ["/", "/index.html", "/s.js", "/api/*", "/sitemap.xml"] },
        // The build copies README.md and llms.txt from sibling packages: hash them too, or the build is skipped
        // when only they change and the deploy ships stale markdown.
        memo: { include: ["**/*", "../../README.md", "../../packages/tcut/docs/llms.txt", "../../packages/tcut/package.json"], lockfile: true },
        domain: stack.stage === "production" ? PRODUCTION_DOMAIN : undefined,
        dev: {
          command: "bun run dev",
        },
      })),
    );

    return {
      web: web.url,
    };
  }),
);
