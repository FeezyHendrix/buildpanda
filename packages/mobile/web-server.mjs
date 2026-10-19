import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

// Serves the `expo export --platform web` output. The cross-origin isolation
// headers are the reason this file exists instead of a generic static host:
// expo-sqlite's web worker synchronises over SharedArrayBuffer, which browsers
// only expose on COOP+COEP pages. Remove them and the local database never
// initialises.
const root = process.argv[2] ?? join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const port = Number(process.env.PORT ?? 4173);

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".wasm": "application/wasm",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json",
};

// Hashed bundle assets never change; the HTML shell must always revalidate so
// a new deploy is picked up on the next load.
function cacheControl(rel) {
  return rel.startsWith("/_expo/") || rel.startsWith("/assets/")
    ? "public, max-age=31536000, immutable"
    : "no-cache";
}

createServer(async (req, res) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  if (rel === "/" || rel === "\\") rel = "/index.html";

  try {
    const body = await readFile(join(root, rel));
    res.setHeader("Content-Type", TYPES[extname(rel)] ?? "application/octet-stream");
    res.setHeader("Cache-Control", cacheControl(rel));
    res.end(body);
  } catch {
    try {
      // Single-page fallback: expo-router owns every other path.
      const body = await readFile(join(root, "index.html"));
      res.setHeader("Content-Type", TYPES[".html"]);
      res.setHeader("Cache-Control", "no-cache");
      res.end(body);
    } catch {
      res.statusCode = 404;
      res.end("not found");
    }
  }
}).listen(port, "0.0.0.0", () => {
  process.stdout.write(`field tool web on :${port} root=${root}\n`);
});
