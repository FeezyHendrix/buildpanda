import { createHash } from "node:crypto";
import { cpSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

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

console.log(
  `field pwa build ${buildId}: ${precache.length} precached paths, ${(totalBytes / 1024 / 1024).toFixed(1)} MB`,
);
