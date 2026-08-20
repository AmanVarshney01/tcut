// @ts-check
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, passthroughImageService } from "astro/config";

// Deployed to GitHub Pages at https://amanvarshney01.github.io/tcut/ by .github/workflows/pages.yml.
// Set SITE / BASE_PATH to deploy elsewhere (e.g. BASE_PATH=/ for a custom domain).
const site = process.env.SITE ?? "https://amanvarshney01.github.io";
const base = process.env.BASE_PATH ?? "/tcut";

export default defineConfig({
  site,
  base,
  output: "static",
  trailingSlash: "ignore",
  // Media is pre-rendered by tcut at the right size (scripts/media.ts); skip Sharp entirely.
  image: { service: passthroughImageService() },
  vite: {
    plugins: [tailwindcss()],
    server: { fs: { allow: ["../.."] } },
  },
});
