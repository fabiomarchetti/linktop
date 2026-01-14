// Service Worker per LINKTOP PWA
const CACHE_NAME = 'linktop-v1';
const RUNTIME_CACHE = 'linktop-runtime';

// Risorse da cachare al primo caricamento
const STATIC_CACHE_URLS = [
  '/utente',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
];

// Installazione del service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_CACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

// Attivazione del service worker
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Strategia di fetch: Network First, fallback su Cache
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Skip API calls - sempre network
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clona la risposta e la mette in cache
        if (response.status === 200) {
          const responseClone = response.clone();
          caches.open(RUNTIME_CACHE).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // In caso di errore, prova a recuperare dalla cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Se non c'è in cache, ritorna una pagina offline
          return caches.match('/utente');
        });
      })
  );
});
