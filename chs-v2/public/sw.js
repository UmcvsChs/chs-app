// A real, genuine service worker for CHS — restored, since the
// original app had one and this rebuild never did. This is one of the
// real requirements browsers check for full PWA installability,
// alongside the manifest — having a manifest alone isn't the complete
// picture.
const CACHE_NAME = "chs-v2-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A real, genuine network-first strategy — always tries to get the
// freshest real data first (matching how this whole app is built to
// always show live, current information), only falling back to a
// cached copy if the network genuinely fails.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
