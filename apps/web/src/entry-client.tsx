import { RouterClient } from "@tanstack/react-router/ssr/client";
import { RouterProvider } from "@tanstack/react-router";
import { createRoot, hydrateRoot } from "react-dom/client";
import { createRouter } from "./router";

// Production pages are prerendered (scripts/prerender.ts) and carry the router's dehydrated state; hydrate them.
// The dev server serves a bare shell instead, so render the document from scratch there.
const router = createRouter();
if ("$_TSR" in window) hydrateRoot(document, <RouterClient router={router} />);
else createRoot(document).render(<RouterProvider router={router} />);
