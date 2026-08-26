import { readFileSync } from "node:fs";
import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { recmaCodeHike, remarkCodeHike, type CodeHikeConfig } from "codehike/mdx";
import { defineConfig, type Plugin } from "vite";
import { codeTheme } from "./src/theme";

// Code Hike highlights at compile time (syntaxHighlighting.theme), so components receive HighlightedCode
// and no highlighter ships to the browser.
const codeHike: CodeHikeConfig = {
  components: { code: "Code" },
  syntaxHighlighting: { theme: codeTheme },
};

/** Structured identity for search engines and AI answers; the version comes from the published package. */
function jsonLd(): Plugin {
  const pkg = JSON.parse(readFileSync(new URL("../../packages/tcut/package.json", import.meta.url), "utf8")) as { version: string };
  const data = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "tcut",
    alternateName: "termcut",
    description: "Script a terminal session in TypeScript, record it once, render it anywhere — MP4, GIF, WebM, SVG, HTML — identical every time. Built on Bun.",
    url: "https://tcut.amanv.dev/",
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Linux, Windows",
    softwareVersion: pkg.version,
    license: "https://opensource.org/licenses/MIT",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    downloadUrl: "https://www.npmjs.com/package/termcut",
    codeRepository: "https://github.com/AmanVarshney01/tcut",
    programmingLanguage: "TypeScript",
    author: { "@type": "Person", name: "Aman Varshney", url: "https://github.com/AmanVarshney01" },
    sameAs: ["https://github.com/AmanVarshney01/tcut", "https://www.npmjs.com/package/termcut"],
  };
  return {
    name: "tcut-json-ld",
    transformIndexHtml: (html) => html.replace("<!--JSON-LD-->", `<script type="application/ld+json">${JSON.stringify(data)}</script>`),
  };
}

export default defineConfig({
  server: { port: 4321 },
  plugins: [
    { enforce: "pre", ...mdx({ remarkPlugins: [[remarkCodeHike, codeHike]], recmaPlugins: [[recmaCodeHike, codeHike]] }) },
    tailwindcss(),
    tanstackRouter({ target: "react", autoCodeSplitting: false }),
    react(),
    jsonLd(),
  ],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  build: { target: "es2022", sourcemap: false },
});
