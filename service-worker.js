const CACHE_NAME = "pwa-youtube-v1";
const BASE_URL = self.registration.scope;

const urlsToCache = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}offline.html`,
  `${BASE_URL}manifest.json`,
  `${BASE_URL}assets/style.css`,        // ← CSS di dalam folder assets
  `${BASE_URL}icons/icon-192x192.png`,  // ← Icon di dalam folder icons
  `${BASE_URL}icons/icon-512x512.png`,  // ← Icon di dalam folder icons
  'https://apis.google.com/js/api.js',
];

// Install Service Worker
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.error("Cache gagal dimuat:", err))
  );
});

// Aktivasi dan hapus cache lama
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log("Menghapus cache lama:", key);
            return caches.delete(key);
          }
        })
      );
      await self.clients.claim();
    })()
  );
});

// Fetch event
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.protocol.startsWith("chrome-extension")) return;
  if (request.method !== "GET") return;

  // File statis lokal
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(response => {
        return (
          response ||
          fetch(request).catch(() => caches.match(`${BASE_URL}offline.html`))
        );
      })
    );
  } 
  // Resource eksternal
  else {
    // YouTube API: Network First + cache
    if (url.href.includes('youtube.googleapis.com/youtube/v3/')) {
      event.respondWith(
        fetch(request)
          .then(networkResponse => {
            if (networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => {
            return caches.match(request).then(cached => {
              if (cached) return cached;
              return new Response('{"error": "Offline - YouTube API tidak tersedia"}', {
                status: 503,
                headers: { 'Content-Type': 'application/json' }
              });
            });
          })
      );
    } 
    // Resource eksternal lain (gambar, CDN, dll)
    else {
      event.respondWith(
        fetch(request)
          .then(networkResponse => {
            if (networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return networkResponse;
          })
          .catch(() => caches.match(request))
      );
    }
  }
});