import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => ({
  define: { "import.meta.env.VITE_APP_RELEASE": JSON.stringify(loadEnv(mode, path.resolve(__dirname, "../../"), "VITE_").VITE_APP_RELEASE || process.env["RAILWAY_GIT_COMMIT_SHA"] || "unknown") },
  envDir: path.resolve(__dirname, "../../"),
  plugins: [react(), tailwindcss()],
  resolve: {
    dedupe: ["react", "react-dom"],
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@svar-ui/react-gantt"],
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
}));
