import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  envDir: path.resolve(__dirname, "../../"),
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["@svar-ui/react-gantt"],
  },
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  // Production preview (Railway): always revalidate so a new deploy's chunk
  // hashes are picked up immediately instead of serving a stale index.html
  // that points at chunks which no longer exist.
  preview: {
    host: true,
    headers: {
      "Cache-Control": "no-cache",
    },
  },
});
