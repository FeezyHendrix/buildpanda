import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

const envDir = path.resolve(__dirname, "../../");

// Error reports carry the build's commit so frontend and backend reports line up.
const appRelease = (mode: string) =>
  loadEnv(mode, envDir, "VITE_").VITE_APP_RELEASE ||
  process.env["RAILWAY_GIT_COMMIT_SHA"] ||
  "unknown";

export default defineConfig(({ mode }) => ({
  define: {
    "import.meta.env.VITE_APP_RELEASE": JSON.stringify(appRelease(mode)),
  },
  envDir,
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
