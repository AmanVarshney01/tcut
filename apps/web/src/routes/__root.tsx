import { createRootRouteWithContext, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import pkg from "../../../../packages/tcut/package.json";
import type { RouterContext } from "../router";
import "../index.css";

const SITE = "https://tcut.amanv.dev";
const TITLE = "tcut — terminal videos, written in TypeScript";
const DESCRIPTION = "Script a terminal session in TypeScript, record it once, render it anywhere — MP4, GIF, WebM, SVG, HTML — identical every time. Built on Bun.";

/** Runs before first paint: a saved theme choice, else the OS preference. The header toggle keeps it in sync. */
const THEME_INIT = `(()=>{const s=localStorage.getItem("tcut-theme");const d=matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";document.documentElement.dataset.theme=s==="light"||s==="dark"?s:d;})();`;

/** Structured identity for search engines and AI answers; the version is the published package's. */
const JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "tcut",
  alternateName: "termcut",
  description: DESCRIPTION,
  url: `${SITE}/`,
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
});

export const Route = createRootRouteWithContext<RouterContext>()({
  loader: ({ context }) => context.assets,
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE}/` },
      { property: "og:image", content: `${SITE}/og.png` },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "theme-color", content: "#e8ebee", media: "(prefers-color-scheme: light)" },
      { name: "theme-color", content: "#0b0d12", media: "(prefers-color-scheme: dark)" },
    ],
    links: [
      { rel: "canonical", href: `${SITE}/` },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "sitemap", href: "/sitemap.xml" },
      ...(loaderData?.styles ?? []).map((href) => ({ rel: "stylesheet", href })),
    ],
    scripts: [
      { children: THEME_INIT },
      { type: "application/ld+json", children: JSON_LD },
      { defer: true, src: "/s.js", "data-website-id": "d3230e89-0ee6-4065-80f6-29d68e382b32", "data-host-url": SITE },
      ...(loaderData?.scripts ?? []).map((src) => ({ type: "module", src })),
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <Scripts />
      </body>
    </html>
  );
}
