// The service worker at /sw.js once Next is gone (served by
// server/src/standalone/worker.rs). Visitors of the Next site have Next's
// Serwist worker (app/sw.ts) installed; the browser compares /sw.js on its
// next navigation, finds this one, and installs it in place of the old one.
//
// It keeps the one feature the old worker gave pages: a failed navigation
// shows /offline. Everything else goes to the network untouched, and every
// cache the old worker filled (its precache of /_next/static, the runtime
// caches of defaultCache) is deleted, so nothing of Next is served again.
const OFFLINE_CACHE = "memecatch-offline-v1";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  // Take over from the old worker at once, as it did itself (skipWaiting).
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: "reload" })))
      // Offline during the install: the worker still replaces the old one.
      .catch(() => undefined),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== OFFLINE_CACHE).map((name) => caches.delete(name)));
      // The old worker turned navigation preload on; this one does not use it.
      await self.registration.navigationPreload?.disable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(async () => {
      const offline = await caches.match(OFFLINE_URL, { cacheName: OFFLINE_CACHE });
      return offline ?? Response.error();
    }),
  );
});
