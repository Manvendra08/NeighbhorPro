// ProNeighbor Service Worker
// Caches app shell for offline/fast load. Firebase data always fetches fresh.

const CACHE_NAME = 'proneighbor-v1';

// App shell files to pre-cache
const PRECACHE = [
  '/',
  '/images/logo.png',
  '/images/hero-bg.jpg',
];

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// Activate — clear old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
//   - Navigation (HTML)  → Network first, fall back to cached /
//   - Firebase/API calls → Network only (never cache dynamic data)
//   - Static assets      → Cache first, network fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept Firebase, Razorpay, or external API calls
  if (
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('razorpay') ||
    url.hostname.includes('cloudinary') ||
    url.hostname.includes('googleapis.com')
  ) {
    return; // let browser handle
  }

  // Navigation requests — network first, offline fallback to /
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/').then(r => r || new Response('Offline', { status: 503 }))
      )
    );
    return;
  }

  // Static assets — cache first
  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache successful GET responses for static files
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
