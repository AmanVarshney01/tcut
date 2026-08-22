// @ts-check
import tailwindcss from "@tailwindcss/vite";
import sitemap from "@astrojs/sitemap";
import { defineConfig, passthroughImageService } from "astro/config";

// Deployed to Cloudflare Workers (static assets) with Alchemy — see packages/infra/alchemy.run.ts.
// SITE is the public origin used for canonical/OG URLs; BASE_PATH only matters for sub-path hosting.
const site = process.env.SITE ?? "https://tcut.amanv.dev";
const base = process.env.BASE_PATH ?? "/";

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "ignore",
  // sitemap-index.xml + sitemap-0.xml; the Worker also answers /sitemap.xml. lastmod = build time.
  integrations: [sitemap({ lastmod: new Date() })],
  // Media is pre-rendered by tcut at the right size (scripts/media.ts); skip Sharp entirely.
  image: { service: passthroughImageService() },
  vite: {
    plugins: [tailwindcss()],
    server: { fs: { allow: ["../.."] } },
  },
});
