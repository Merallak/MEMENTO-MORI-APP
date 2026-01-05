/* Basic, conservative service worker for Next.js (Pages Router).
   Caches only safe static assets:
   - /_next/static/* (hashed)
   - selected public files (icons/manifest)
*/
const CACHE_NAME = "mm-static-v1";

const ASSET_PATHS = new Set([
  "/192.png",
  "/512.png",
  "/favicon.ico",
  "/manifest.json",
  "/grid.svg",
]);

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

  // Only cache GET requests
  if (req.method !== "GET") return;

  const url = new URL(req.url);

  // Only same-origin
  if (url.origin !== self.location.origin) return;

  const isNextStatic = url.pathname.startsWith("/_next/static/");
  const isAllowedPublicAsset = ASSET_PATHS.has(url.pathname);

  if (!isNextStatic && !isAllowedPublicAsset) {
    // Do not cache HTML or dynamic routes (network only)
    return;
  }

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(req);
      if (cached) return cached;

      const res = await fetch(req);
      // Cache only successful basic/cors responses
      if (res && (res.type === "basic" || res.type === "cors") && res.ok) {
        await cache.put(req, res.clone());
      }
      return res;
    })()
  );
});