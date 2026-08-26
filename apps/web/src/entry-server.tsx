// Static prerender: render a URL to a complete HTML document with the router's own server renderer, so the
// markup and the dehydrated state match what RouterClient expects to hydrate.
import { createRequestHandler, renderRouterToString, RouterServer } from "@tanstack/react-router/ssr/server";
import { type Assets, createRouter } from "./router";

export async function render(url: string, assets: Assets): Promise<string> {
  const handler = createRequestHandler({ request: new Request(url), createRouter: () => createRouter({ assets }) });
  const response = await handler(({ responseHeaders, router }) => renderRouterToString({ responseHeaders, router, children: <RouterServer router={router} /> }));
  return response.text();
}
