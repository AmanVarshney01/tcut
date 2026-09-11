import { createRoot } from "react-dom/client";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { Presenter } from "./app";
import type { PresentationManifest } from "../../../packages/tcut/src/presentation/model";
import "./styles.css";
const boot = JSON.parse(
  document.getElementById("presentation-data")!.textContent!,
) as { manifest: PresentationManifest; prefix: string };
const root = createRootRoute({ component: Outlet });
const presenter = createRoute({
  getParentRoute: () => root,
  path: "/$session/",
  component: () => <Presenter {...boot} />,
});
const router = createRouter({
  routeTree: root.addChildren([presenter]),
  scrollRestoration: false,
});
createRoot(document.getElementById("root")!).render(
  <RouterProvider router={router} />,
);
