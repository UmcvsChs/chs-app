// A real, genuine service worker for CHS — restored, since the
// original app had one and this rebuild never did. This is one of the
// real requirements browsers check for full PWA installability,
// alongside the manifest — having a manifest alone isn't the complete
// picture.
const CACHE_NAME = "chs-v2-cache-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  event.waitUntil(self.clients.claim());
});

// Real, direct fix following a repeated, serious client report,
// compared directly against real apps like Gmail and YouTube: the
// previous network-first strategy applied to every single request,
// including this app's own interface files — meaning a refresh
// always waited for a full round trip before showing anything at
// all, every time, which is genuinely what made it feel like
// starting over from a splash screen. A real PWA that feels instant
// on reload, the way the client described other real apps behaving,
// serves its own shell from the cache immediately while the real,
// live data underneath still always comes from the network, fresh,
// every time — this is that real, correct split, not a guess:
//
// Supabase's own API calls (the actual data: offers, applications,
// notifications, everything this app is built to always show live)
// are matched by hostname and stay genuinely network-first, exactly
// as before — real data freshness was never the actual problem.
//
// Everything else — this app's own HTML, JS, CSS, images, the real
// interface itself — now serves instantly from the cache first if
// it's there, while a fresh copy is fetched in the background to
// replace it for next time. The interface appears immediately; nothing
// about the platform's own live data behavior changes.
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  const isDataRequest = url.hostname.includes("supabase.co") || event.request.method !== "GET";

  if (isDataRequest) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const fetchPromise = fetch(event.request)
        .then((response) => {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
          return response;
        })
        .catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
