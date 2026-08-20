// CHS service worker — required for the app to be recognised as a genuine
// installable PWA and launch as a standalone app (no browser address bar),
// rather than falling back to opening inside Chrome as a plain bookmark.
const CACHE_NAME = 'chs-v1';

self.addEventListener('install', function(event){
  self.skipWaiting();
});

self.addEventListener('activate', function(event){
  event.waitUntil(self.clients.claim());
});

// A minimal fetch handler is required by Chrome's installability criteria.
// This simply passes every request straight through to the network —
// it does not change or intercept any app behaviour.
self.addEventListener('fetch', function(event){
  event.respondWith(fetch(event.request).catch(function(){
    return caches.match(event.request);
  }));
});
