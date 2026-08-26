import { createRouter, RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { routeTree } from "./routeTree.gen";

const router = createRouter({ routeTree, scrollRestoration: true });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const root = document.getElementById("app");
if (!root) throw new Error("Root element #app not found");
createRoot(root).render(<RouterProvider router={router} />);
