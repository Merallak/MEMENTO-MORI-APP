/* Basic, conservative service worker for Next.js (Pages Router).
   Caches only safe static assets:
   - /_next/static/* (hashed in prod; in dev can be non-hashed so we avoid caching on localhost)
   - selected public files (icons/manifest)
*/
const CACHE_NAME = "mm-static-v2";

const ASSET_PATHS = new Set([
  "/192.png",
  "/512.png",
  "/favicon.ico",
  "/manifest.json",
  "/grid.svg",
]);

const IS_LOCALHOST =
  self.location.hostname === "localhost" ||
  self.location.hostname === "127.0.0.1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(Promise.resolve());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k.startsWith("mm-static-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;

  if (req.method !== "GET") return;

  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  const isNextStatic = url.pathname.startsWith("/_next/static/");
  const isAllowedPublicAsset = ASSET_PATHS.has(url.pathname);

  // In dev, avoid caching Next static chunks (can change without URL changing)
  if (IS_LOCALHOST && isNextStatic) return;

  if (!isNextStatic && !isAllowedPublicAsset) {
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      const res = await fetch(req);
      if (res && (res.type === "basic" || res.type === "cors") && res.ok) {
        await cache.put(req, res.clone());
      }
      return res;
    })()
  );
});