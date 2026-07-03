/* BuildPanda service worker.
 *
 * Strategy:
 * - Cache-first for same-origin hashed static assets under /assets/ (Vite
 *   emits content-hashed filenames, so a cached asset can never go stale).
 * - Network-only for everything else — navigations (index.html) and /api are
 *   NEVER cached. The app relies on a fresh index.html to detect new deploys
 *   (see the stale-chunk reload in App.tsx's custom lazy()); serving a stale
 *   shell or stale API data would break that mechanism.
 *
 * Bump CACHE_VERSION to invalidate previously cached assets on deploy of a
 * new worker; old caches are cleaned on activate.
 */

const CACHE_VERSION = "v1";
const CACHE_NAME = `buildpanda-static-${CACHE_VERSION}`;

self.addEventListener("install", () => {
  // Activate the new worker immediately instead of waiting for old tabs.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("buildpanda-static-") && key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function isCacheableAsset(request) {
  if (request.method !== "GET") return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false;
  // Only Vite's content-hashed build output — never HTML, never /api.
  return url.pathname.startsWith("/assets/");
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Network-only for navigations and API calls: fall through to the browser
  // (no respondWith) so the SW never interposes a cache for them.
  if (!isCacheableAsset(request)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});

/*
 * Part 2: push notifications. The backend sends a JSON payload of
 * { title, body, url } (see modules/notifications/push-job.ts); url is the
 * notification's CTA/deep link into the app.
 */

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    // Non-JSON payload (shouldn't happen from our backend) — fall back to text.
    payload = { body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "BuildPanda";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: payload.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: payload.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    (async () => {
      // Prefer an already-open app tab: focus it and navigate to the deep link.
      const windowClients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windowClients) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(url);
          }
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
