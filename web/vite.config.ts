import { defineConfig, type Connect, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

// The app's own pages (/app/markets, /app/markets/bold, …) all load app/index.html, exactly as vercel.json and
// public/_redirects do in production. Anything with a file extension (assets, JSON, fonts) is left alone.
const appFallback: Connect.NextHandleFunction = (req, _res, next) => {
  const path = (req.url ?? "").split("?")[0];
  if ((path === "/app" || path.startsWith("/app/")) && !/\.[a-z0-9]+$/i.test(path)) req.url = "/app/index.html";
  next();
};
const appRoutes: Plugin = {
  name: "cosign-app-routes",
  configureServer: (s) => { s.middlewares.use(appFallback); },
  configurePreviewServer: (s) => { s.middlewares.use(appFallback); },
};

// Two pages: the website at / and the app at /app/. An absolute base so assets load from any depth of app URL.
export default defineConfig({
  plugins: [react(), appRoutes],
  base: "/",
  build: { rollupOptions: { input: { site: "index.html", app: "app/index.html" } } },
});
