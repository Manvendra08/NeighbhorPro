// ProNeighbor Service Worker
// Caches app shell for offline/fast load. Dynamic data always fetches fresh.

const CACHE_NAME = 'proneighbor-v2';

// App shell files to pre-cache.
const PRECACHE = [
  '/',
  '/images/logo.png',
  '/images/hero-bg.jpg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isHttpRequest = url.protocol === 'http:' || url.protocol === 'https:';
  const isSameOrigin = url.origin === self.location.origin;

  // Ignore non-http, non-GET, and cross-origin requests.
  if (!isHttpRequest || request.method !== 'GET' || !isSameOrigin) {
    return;
  }

  // Ignore Vite dev internals if an old SW is still active during local dev.
  if (
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@vite/') ||
    url.pathname.startsWith('/@fs/') ||
    url.pathname.includes('__vite_ping')
  ) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // HTML navigation: network first, then fallback to cached shell.
        if (request.mode === 'navigate') {
          try {
            return await fetch(request);
          } catch {
            const fallback = await caches.match('/');
            return fallback || new Response('Offline', { status: 503 });
          }
        }

        // Static assets: cache first, then network.
        const cached = await caches.match(request);
        if (cached) {
          return cached;
        }

        try {
          const response = await fetch(request);
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        } catch {
          return new Response('Offline', { status: 503 });
        }
      } catch {
        // Ensure no unhandled promise rejections escape from SW fetch handler.
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});
