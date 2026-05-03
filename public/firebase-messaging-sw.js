importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// Firebase configuration (safe to expose in client-side service worker)
firebase.initializeApp({
  apiKey: "AIzaSyDLa5-OsjK3iSTfHur4kKfRPJl9_fu8Pk0",
  authDomain: "neighbhorpro.firebaseapp.com",
  projectId: "neighbhorpro",
  storageBucket: "neighbhorpro.firebasestorage.app",
  messagingSenderId: "1078165325381",
  appId: "1:1078165325381:web:8cb8cc849068001ba0c52c",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage(payload => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'ProNeighbor';
  const notificationOptions = {
    body: payload.notification?.body || 'You have a new notification',
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    data: payload.data,
    tag: payload.data?.tag || 'default', // Group notifications
    requireInteraction: false,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', event => {
  console.log('[firebase-messaging-sw.js] Notification click received.', event);
  event.notification.close();
  
  const urlToOpen = event.notification.data?.url || '/dashboard';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
      // Check if there is already a window/tab open with the target URL
      for (let client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      // If no window/tab is open, open a new one
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
