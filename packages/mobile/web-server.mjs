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

// Both encodings are written beside each asset at build time, so a request only
// picks one. Vary keeps a shared cache from handing a brotli body to a client
// that cannot decode it; the Content-Type stays that of the decoded file.
const ENCODINGS = [
  ["br", ".br"],
  ["gzip", ".gz"],
];

async function send(res, rel, accept, cache) {
  const absolute = join(root, rel);
  res.setHeader("Content-Type", TYPES[extname(rel)] ?? "application/octet-stream");
  res.setHeader("Cache-Control", cache ?? cacheControl(rel));
  res.setHeader("Vary", "Accept-Encoding");

  for (const [token, suffix] of ENCODINGS) {
    if (!accept.includes(token)) continue;
    try {
      const encoded = await readFile(absolute + suffix);
      res.setHeader("Content-Encoding", token);
      res.end(encoded);
      return;
    } catch {
      // No sibling for this encoding: try the next, then the plain file.
    }
  }

  res.end(await readFile(absolute));
}

createServer(async (req, res) => {
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Embedder-Policy", "require-corp");
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const urlPath = decodeURIComponent(new URL(req.url ?? "/", "http://x").pathname);
  let rel = normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  if (rel === "/" || rel === "\\") rel = "/index.html";

  const accept = String(req.headers["accept-encoding"] ?? "");

  try {
    await send(res, rel, accept);
  } catch {
    try {
      // Single-page fallback: expo-router owns every other path.
      await send(res, "/index.html", accept, "no-cache");
    } catch {
      res.statusCode = 404;
      res.end("not found");
    }
  }
}).listen(port, "0.0.0.0", () => {
  process.stdout.write(`field tool web on :${port} root=${root}\n`);
});
