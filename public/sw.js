// POLYFAUNA Service Worker — Web Push handler
const APP_URL = self.location.origin;

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'POLYFAUNA', body: event.data?.text() || 'Nueva notificación' };
  }

  const title   = data.title || 'POLYFAUNA';
  const options = {
    body:    data.body    || '',
    icon:    data.icon    || `${APP_URL}/logo192.png`,
    badge:   data.badge   || `${APP_URL}/logo96.png`,
    image:   data.image   || undefined,
    data:    { url: data.url || APP_URL },
    tag:     data.tag     || 'polyfauna-notification',
    renotify: true,
    vibrate: [120, 60, 120],
    actions: data.actions || [],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || APP_URL;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.startsWith(APP_URL) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
