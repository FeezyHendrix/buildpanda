/* BuildPanda Field service worker.
 *
 * The opposite trade to the desktop app's worker: crews open this on sites
 * with no signal, so the SHELL must launch from cache. Navigations go
 * network-first (a deploy lands on the next connected load) and fall back to
 * the cached shell offline. Hashed build assets are immutable, so cache-first.
 *
 * API and auth calls are cross-origin and NEVER touched here — the app's own
 * SQLite + outbox layer owns offline data, and a worker cache in front of it
 * would serve stale records and fight the sync engine.
 *
 * Replayed cached responses keep their original headers, which is what
 * preserves COOP/COEP (and therefore SharedArrayBuffer for the local
 * database) when the shell loads offline.
 */

const BUILD_ID = "__BUILD_ID__";
const SHELL_CACHE = `field-shell-${BUILD_ID}`;
const PRECACHE = __PRECACHE__;
const NAVIGATION_TIMEOUT_MS = 4000;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      await cache.addAll(PRECACHE);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("field-shell-") && key !== SHELL_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function fromNetworkWithTimeout(request, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function handleNavigation(request) {
  const cache = await caches.open(SHELL_CACHE);
  try {
    const response = await fromNetworkWithTimeout(request, NAVIGATION_TIMEOUT_MS);
    if (response.ok) {
      await cache.put("/", response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match("/");
    if (cached) return cached;
    throw new Error("offline and no cached shell");
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    url.pathname.startsWith("/_expo/") ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/www.bundle/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico"
  ) {
    event.respondWith(cacheFirst(request));
  }
});
