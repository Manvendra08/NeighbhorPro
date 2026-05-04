// ProNeighbor Service Worker
// Handles both app-shell caching AND Firebase Cloud Messaging (FCM).
// A single SW at scope "/" avoids the two-SW conflict where firebase-messaging-sw.js
// and sw.js would compete for the same scope.

importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// ── Firebase init (safe to expose — same values as the web app) ────────────
firebase.initializeApp({
  apiKey: "AIzaSyDLa5-OsjK3iSTfHur4kKfRPJl9_fu8Pk0",
  authDomain: "neighbhorpro.firebaseapp.com",
  projectId: "neighbhorpro",
  storageBucket: "neighbhorpro.firebasestorage.app",
  messagingSenderId: "1078165325381",
  appId: "1:1078165325381:web:8cb8cc849068001ba0c52c",
});

const messaging = firebase.messaging();

// ── FCM: background messages ───────────────────────────────────────────────
messaging.onBackgroundMessage(payload => {
  const title = payload.notification?.title || 'ProNeighbor';
  const options = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    data: payload.data,
    tag: payload.data?.tag || 'proneighbor-default',
    requireInteraction: false,
  };
  self.registration.showNotification(title, options);
});

// ── FCM: notification click ────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/dashboard';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      for (const client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});

// ── App shell caching ──────────────────────────────────────────────────────
const CACHE_NAME = 'proneighbor-v3-20260504';

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

  if (!isHttpRequest || request.method !== 'GET' || !isSameOrigin) {
    return;
  }

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
        if (request.mode === 'navigate') {
          try {
            return await fetch(request);
          } catch {
            const fallback = await caches.match('/');
            return fallback || new Response('Offline', { status: 503 });
          }
        }

        const cached = await caches.match(request);
        if (cached) return cached;

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
        return new Response('Offline', { status: 503 });
      }
    })()
  );
});
