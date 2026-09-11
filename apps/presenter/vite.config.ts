import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

const presentation = process.env.TCUT_PRESENT_URL
  ? new URL(process.env.TCUT_PRESENT_URL)
  : undefined;

// In dev, reuse the local CLI's boot document and API while Vite serves React with HMR.
function localPresenter(): Plugin {
  return {
    name: "tcut-local-presenter",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const route = req.url?.split("?")[0];
        if (!presentation) {
          if (route !== "/") return next();
          res.statusCode = 503;
          res.end(
            "Start tcut present, then set TCUT_PRESENT_URL to its local URL before starting Vite.",
          );
          return;
        }
        if (route === "/") {
          res.statusCode = 302;
          res.setHeader("location", presentation.pathname);
          res.end();
          return;
        }
        if (route !== presentation.pathname)
          return next();
        try {
          const response = await fetch(new URL(route, presentation.origin));
          const html = (await response.text())
            .replace(`${presentation.pathname}app.js`, "/src/main.tsx")
            .replace(
              `<link rel="stylesheet" href="${presentation.pathname}app.css">`,
              "",
            );
          res.setHeader("content-type", "text/html");
          res.end(await server.transformIndexHtml(route, html));
        } catch (error) {
          next(error);
        }
      });
    },
  };
}

// The CLI embeds these two assets so presentation mode works entirely offline.
export default defineConfig(({ command }) => ({
  define:
    command === "build"
      ? { "process.env.NODE_ENV": JSON.stringify("production") }
      : undefined,
  plugins: [localPresenter(), tailwindcss(), react()],
  server: {
    host: "127.0.0.1",
    port: 4322,
    proxy: presentation
      ? {
          [presentation.pathname]: {
            target: presentation.origin,
            changeOrigin: true,
            configure(proxy) {
              proxy.on("proxyReq", (req) =>
                req.setHeader("origin", presentation.origin),
              );
            },
          },
        }
      : undefined,
  },
  build: {
    target: "es2022",
    lib: {
      entry: "src/main.tsx",
      formats: ["es"],
      fileName: () => "presenter.js",
      cssFileName: "presenter",
    },
    rolldownOptions: { output: { codeSplitting: false } },
    minify: true,
  },
}));
