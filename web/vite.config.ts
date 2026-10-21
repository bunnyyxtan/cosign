import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Two pages: the website at / and the app at /app/. Relative base so the build works from any path.
export default defineConfig({
  plugins: [react()],
  base: "./",
  build: { rollupOptions: { input: { site: "index.html", app: "app/index.html" } } },
});
