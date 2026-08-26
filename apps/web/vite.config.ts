import mdx from "@mdx-js/rollup";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { recmaCodeHike, remarkCodeHike, type CodeHikeConfig } from "codehike/mdx";
import { defineConfig } from "vite";
import { codeTheme } from "./src/theme.ts";

// Code Hike highlights at compile time (syntaxHighlighting.theme), so components receive HighlightedCode
// and no highlighter ships to the browser.
const codeHike: CodeHikeConfig = {
  components: { code: "Code" },
  syntaxHighlighting: { theme: codeTheme },
};

export default defineConfig({
  server: { port: 4321 },
  plugins: [
    { enforce: "pre", ...mdx({ remarkPlugins: [[remarkCodeHike, codeHike]], recmaPlugins: [[recmaCodeHike, codeHike]] }) },
    tailwindcss(),
    tanstackRouter({ target: "react", autoCodeSplitting: false }),
    react(),
  ],
  resolve: { alias: { "@": new URL("./src", import.meta.url).pathname } },
  build: {
    target: "es2022",
    sourcemap: false,
    // the client is built from the entry module (not index.html) and describes itself in a manifest,
    // which the prerender reads to reference the hashed bundle and stylesheet from the document head
    manifest: true,
    rollupOptions: { input: "src/entry-client.tsx" },
  },
});
