// Worker in front of the static assets (Alchemy StaticSite `main`). Three jobs:
//   1. first-party analytics: /s.js and /api/send proxy to Umami, so filter lists have nothing to match
//   2. markdown content negotiation: `Accept: text/markdown` on a page returns its markdown twin (+ Vary: Accept)
//   3. small agent courtesies: /sitemap.xml alias, a markdown 404 body
// Everything else is delegated to the asset layer untouched.

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

const UMAMI = "https://umami.amanv.cloud";
const ORIGIN = "https://tcut.amanv.dev";

const wantsMarkdown = (request: Request): boolean => {
  const accept = request.headers.get("accept") ?? "";
  // text/markdown listed, and ranked above text/html when both are present
  const md = accept.indexOf("text/markdown");
  if (md < 0) return false;
  const html = accept.indexOf("text/html");
  return html < 0 || md < html;
};

const withVary = (response: Response): Response => {
  const out = new Response(response.body, response);
  const vary = out.headers.get("vary");
  if (!vary) out.headers.set("vary", "Accept");
  else if (!/\baccept\b/i.test(vary)) out.headers.set("vary", `${vary}, Accept`);
  return out;
};

const markdown = (body: string, status = 200, extra: HeadersInit = {}): Response =>
  new Response(body, { status, headers: { "content-type": "text/markdown; charset=utf-8", vary: "Accept", ...extra } });

const NOT_FOUND_MD = `# Not found

Nothing lives at this path. Where to look instead:

- Home: ${ORIGIN}/ (send \`Accept: text/markdown\` for the markdown version)
- Agent guide: ${ORIGIN}/llms.txt
- Sitemap: ${ORIGIN}/sitemap.xml
- Reference: https://github.com/AmanVarshney01/tcut/blob/main/packages/tcut/docs/REFERENCE.md
`;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    // 1. Umami, first-party
    if (pathname === "/s.js" && request.method === "GET") {
      const upstream = await fetch(`${UMAMI}/script.js`, { cf: { cacheTtl: 3600 } } as RequestInit);
      const out = new Response(upstream.body, upstream);
      out.headers.set("content-type", "text/javascript; charset=utf-8");
      out.headers.set("cache-control", "public, max-age=3600");
      return out;
    }
    if (pathname === "/api/send" && request.method === "POST") {
      const headers = new Headers();
      headers.set("content-type", request.headers.get("content-type") ?? "application/json");
      const ua = request.headers.get("user-agent");
      if (ua) headers.set("user-agent", ua);
      const ip = request.headers.get("cf-connecting-ip");
      if (ip) headers.set("x-forwarded-for", ip);
      const lang = request.headers.get("accept-language");
      if (lang) headers.set("accept-language", lang);
      return fetch(`${UMAMI}/api/send`, { method: "POST", headers, body: request.body });
    }

    // 3. sitemap alias (the Astro integration writes sitemap-index.xml)
    if (pathname === "/sitemap.xml") {
      return env.ASSETS.fetch(new Request(`${url.origin}/sitemap-index.xml`, request));
    }

    // 2. markdown twin of a page
    const md = wantsMarkdown(request);
    if (md && (pathname === "/" || pathname === "/index.html")) {
      const twin = await env.ASSETS.fetch(new Request(`${url.origin}/index.md`, { method: "GET" }));
      if (twin.ok) return markdown(await twin.text());
    }

    const response = await env.ASSETS.fetch(request);
    if (response.status === 404 && md) return markdown(NOT_FOUND_MD, 404);
    const type = response.headers.get("content-type") ?? "";
    return type.includes("text/html") ? withVary(response) : response;
  },
};
