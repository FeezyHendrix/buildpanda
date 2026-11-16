import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

export default defineConfig({
  envDir: path.resolve(import.meta.dirname, "../../"),
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@field-ui": path.resolve(import.meta.dirname, "../frontend/src/components/atoms"),
      "@": path.resolve(import.meta.dirname, "../frontend/src"),
    },
  },
  server: {
    host: true,
    port: 5175,
    strictPort: true,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (value) => value.replace(/^\/api/, ""),
      },
    },
  },
  preview: { host: true, headers: { "Cache-Control": "no-cache" } },
});
