importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            self.__WB_MANIFEST_FIREBASE_API_KEY || '',
  authDomain:        self.__WB_MANIFEST_FIREBASE_AUTH_DOMAIN || '',
  projectId:         self.__WB_MANIFEST_FIREBASE_PROJECT_ID || 'neighbhorpro',
  storageBucket:     self.__WB_MANIFEST_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: self.__WB_MANIFEST_FIREBASE_MESSAGING_SENDER_ID || '',
  appId:             self.__WB_MANIFEST_FIREBASE_APP_ID || '',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  const { title = 'ProNeighbor', body = '' } = payload.notification || {};
  self.registration.showNotification(title, {
    body,
    icon: '/images/logo.png',
    badge: '/images/logo.png',
    data: payload.data,
  });
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = event.notification.data?.url || '/dashboard';
  event.waitUntil(clients.openWindow(url));
});
