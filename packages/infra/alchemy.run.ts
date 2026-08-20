// Cloudflare deployment for the website, managed by Alchemy (the better-t-stack Cloudflare option).
// The site is fully static, so it ships as a Worker serving content-hashed assets (Cloudflare.Website.StaticSite).
//   bun run deploy          → personal dev_<user> stage on workers.dev
//   bun run deploy:prod     → --stage production, served at https://tcut.amanv.dev (DNS + cert provisioned by Alchemy)
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
