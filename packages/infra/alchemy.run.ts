// Cloudflare deployment for the website, managed by Alchemy (the better-t-stack Cloudflare option).
// The site is fully static, so it ships as a Worker serving content-hashed assets (Cloudflare.Website.StaticSite).
//   bun run deploy          → personal dev_<user> stage
//   bun run deploy:prod     → --stage production
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import * as Effect from "effect/Effect";

export default Alchemy.Stack(
  "tcut",
  {
    providers: Cloudflare.providers(),
    state: Cloudflare.state(),
  },
  Effect.gen(function* () {
    const web = yield* Cloudflare.Website.StaticSite("web", {
      cwd: "../../apps/web",
      command: "bun run build",
      outdir: "dist",
      dev: {
        command: "bun run dev",
      },
    });

    return {
      web: web.url,
    };
  }),
);
