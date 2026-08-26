// One page; lastmod is the last commit that touched the site's content, so it only moves when the page changed.
import path from "node:path";

const web = path.resolve(import.meta.dir, "..");
const iso = await (async () => {
  try {
    const out = await Bun.$`git log -1 --format=%cI -- src public/promo.mp4 ../../README.md ../../packages/tcut/docs/llms.txt`.cwd(web).text();
    return out.trim() || new Date().toISOString();
  } catch {
    return new Date().toISOString();
  }
})();
const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://tcut.amanv.dev/</loc><lastmod>${iso}</lastmod></url>
</urlset>
`;
await Bun.write(path.join(web, "public", "sitemap.xml"), xml);
console.log(`sitemap: lastmod ${iso}`);
