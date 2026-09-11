import type { PresentationManifest } from "./model";

export function presentationPage(manifest: PresentationManifest, prefix: string): string {
  const data = JSON.stringify({ manifest, prefix }).replace(/</g, "\\u003c");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>tcut — Present</title><link rel="icon" href="data:,"><link rel="stylesheet" href="${prefix}app.css"></head>
<body><div id="root"></div><script type="application/json" id="presentation-data">${data}</script><script type="module" src="${prefix}app.js"></script></body></html>`;
}
