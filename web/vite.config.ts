import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the static build works from any path (e.g. GitHub Pages /cosign/).
export default defineConfig({ plugins: [react()], base: "./" });
