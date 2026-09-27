// A real, genuine service worker for CHS — restored, since the
// original app had one and this rebuild never did. This is one of the
// real requirements browsers check for full PWA installability,
// alongside the manifest — having a manifest alone isn't the complete
// picture.
const CACHE_NAME = "chs-v2-cache-v3";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
  );
  event.waitUntil(self.clients.claim());
});

// Real, critical fix reverting a real, confirmed regression from the
// previous version: caching the page itself (not just static files)
// meant a browser could keep showing an old, already-fixed page after
// a new real deployment went live — including references to script
// files from that old build, which no longer exist once a new one
// ships. That's a real, serious risk in an app that deploys real
// fixes constantly, and it directly caused two real, separate
// symptoms reported together: an already-fixed page appearing
// unfixed, and pages hanging or reloading unexpectedly. A cache-first
// strategy is only safe for files that never change once built
// (Next.js's own hashed script and style files, genuinely safe here);
// it is never safe for the page itself. Reverted to always fetching
// fresh, falling back to a cached copy only if the network genuinely
// fails — the same real, correct principle already used for this
// app's real data.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const isHashedStaticAsset = url.pathname.startsWith("/_next/static/");

  if (isHashedStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        });
      })
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
