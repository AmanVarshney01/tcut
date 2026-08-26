import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

/** Built asset URLs the document must reference (from Vite's manifest at prerender time; none in dev). */
export interface Assets {
  scripts: string[];
  styles: string[];
}

export interface RouterContext {
  assets: Assets;
}

export function createRouter(context: RouterContext = { assets: { scripts: [], styles: [] } }) {
  return createTanStackRouter({ routeTree, context, scrollRestoration: true });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
