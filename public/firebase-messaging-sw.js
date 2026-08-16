/* Firebase Cloud Messaging service worker.
   Handles push notifications when the app is closed or backgrounded.
   NOTE: this file must live at the site root (not under /src) so its scope
   covers the whole origin — Vite copies everything in /public as-is. */

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Same config as src/lib/firebase.js — service workers can't import your
// app's JS modules, so the config is duplicated here. Keep them in sync.
firebase.initializeApp({
  apiKey: 'AIzaSyColNN3Kd49mYUluLzQZcatpNw013i8DbQ',
  authDomain: 'scheduling-app-3e0ea.firebaseapp.com',
  projectId: 'scheduling-app-3e0ea',
  storageBucket: 'scheduling-app-3e0ea.firebasestorage.app',
  messagingSenderId: '893592505585',
  appId: '1:893592505585:web:a35f1d268defc2e3506d50',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'Upcoming activity';
  const options = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
