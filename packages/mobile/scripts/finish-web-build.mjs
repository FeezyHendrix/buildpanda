import { createHash } from "node:crypto";
import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { brotliCompressSync, constants, gzipSync } from "node:zlib";

// Turns `expo export --platform web` output into an installable, offline-
// launchable PWA: copies the manifest and icons in, renders sw.js with the
// exact file list of THIS build (its hash is the worker's version, so a new
// deploy is a byte-different worker and updates propagate), and injects the
// manifest/meta/registration tags expo's index.html does not know about.

const here = fileURLToPath(new URL(".", import.meta.url));
const webDir = resolve(here, "../web");
const dist = resolve(process.argv[2] ?? resolve(here, "../dist"));

const SKIP = new Set(["index.html", "sw.js", "metadata.json"]);

cpSync(join(webDir, "manifest.webmanifest"), join(dist, "manifest.webmanifest"));
cpSync(join(webDir, "icons"), join(dist, "icons"), { recursive: true });

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const files = walk(dist)
  .map((full) => relative(dist, full))
  .filter((rel) => !SKIP.has(rel))
  .sort();

const precache = ["/", ...files.map((rel) => encodeURI(`/${rel.split("\\").join("/")}`))];
const totalBytes = files.reduce((sum, rel) => sum + statSync(join(dist, rel)).size, 0);

const hash = createHash("sha256");
for (const rel of files) hash.update(`${rel}:${statSync(join(dist, rel)).size}\n`);
const buildId = hash.digest("hex").slice(0, 12);

const swTemplate = readFileSync(join(webDir, "sw.js"), "utf8");
writeFileSync(
  join(dist, "sw.js"),
  swTemplate.replace("__BUILD_ID__", buildId).replace("__PRECACHE__", JSON.stringify(precache)),
);

const MARKER = "<!-- field-pwa -->";
const indexPath = join(dist, "index.html");
let html = readFileSync(indexPath, "utf8");
if (!html.includes(MARKER)) {
  const headTags = [
    MARKER,
    '<link rel="manifest" href="/manifest.webmanifest">',
    '<meta name="theme-color" content="#004DE7">',
    '<link rel="apple-touch-icon" href="/icons/icon-192.png">',
    '<meta name="apple-mobile-web-app-capable" content="yes">',
    '<meta name="apple-mobile-web-app-status-bar-style" content="default">',
    '<meta name="apple-mobile-web-app-title" content="Field Tools">',
  ].join("");
  const registration =
    "<script>if('serviceWorker' in navigator&&window.isSecureContext){window.addEventListener('load',function(){navigator.serviceWorker.register('/sw.js').catch(function(){})})}</script>";
  html = html.replace("</head>", `${headTags}</head>`).replace("</body>", `${registration}</body>`);
  writeFileSync(indexPath, html);
}

// The host serves these bytes as-is, so an uncompressed multi-megabyte entry
// bundle crosses the wire on every cold load. Both encodings are written once
// here, beside the file they encode, rather than recomputed per request. This
// runs last so the shell is encoded after its PWA tags are injected, and the
// siblings stay out of `precache` because the browser decodes them in place.
const COMPRESSIBLE = new Set([".js", ".mjs", ".css", ".html", ".json", ".webmanifest", ".svg"]);
let plainBytes = 0;
let brotliBytes = 0;
for (const rel of [...files, "index.html"]) {
  if (!COMPRESSIBLE.has(extname(rel))) continue;
  const full = join(dist, rel);
  const raw = readFileSync(full);
  // Below a packet or so, an encoding header costs more than it saves.
  if (raw.byteLength < 1024) continue;
  const brotli = brotliCompressSync(raw, {
    params: {
      [constants.BROTLI_PARAM_QUALITY]: 9,
      [constants.BROTLI_PARAM_SIZE_HINT]: raw.byteLength,
    },
  });
  writeFileSync(`${full}.br`, brotli);
  writeFileSync(`${full}.gz`, gzipSync(raw, { level: 9 }));
  plainBytes += raw.byteLength;
  brotliBytes += brotli.byteLength;
}

const saved = plainBytes > 0 ? Math.round((1 - brotliBytes / plainBytes) * 100) : 0;
console.log(
  `field pwa build ${buildId}: ${precache.length} precached paths, ${(totalBytes / 1024 / 1024).toFixed(1)} MB` +
    ` · brotli ${(plainBytes / 1024 / 1024).toFixed(1)}→${(brotliBytes / 1024 / 1024).toFixed(2)} MB (${saved}% smaller)`,
);
