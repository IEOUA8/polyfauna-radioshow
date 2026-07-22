// POLYFAUNA Service Worker — instalación, modo degradado y Web Push
const APP_URL = self.location.origin;
const CACHE_VERSION = 'polyfauna-v5';
const APP_SHELL = `${CACHE_VERSION}-shell`;
const RUNTIME = `${CACHE_VERSION}-runtime`;
const PRECACHE = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(APP_SHELL).then(cache => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => ![APP_SHELL, RUNTIME].includes(key)).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();
          caches.open(RUNTIME).then(cache => cache.put(request, copy));
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match('/')) || caches.match('/offline.html'))
    );
    return;
  }

  // Las imágenes editoriales pueden actualizarse conservando la misma URL.
  // Servimos inmediatamente la copia local, pero siempre la revalidamos en
  // segundo plano para que una PWA móvil no quede atrapada con una versión
  // anterior. El cambio a v5 también descarta el runtime cache viejo.
  if (request.destination === 'image' || url.pathname.startsWith('/icons/')) {
    const refreshed = fetch(request).then(response => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(RUNTIME).then(cache => cache.put(request, copy));
      }
      return response;
    });

    event.respondWith(
      caches.match(request).then(cached => cached || refreshed)
    );
    event.waitUntil(refreshed.catch(() => undefined));
    return;
  }

  if (['script', 'style', 'font'].includes(request.destination)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(RUNTIME).then(cache => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});

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
    icon:    data.icon    || `${APP_URL}/icons/icon-192.png`,
    badge:   data.badge   || `${APP_URL}/icons/icon-96.png`,
    image:   data.image   || undefined,
    data:    { url: data.url || APP_URL, notificationId: data.notificationId || null },
    tag:     data.tag || (data.notificationId ? `polyfauna-${data.notificationId}` : `polyfauna-${Date.now()}`),
    renotify: true,
    vibrate: [120, 60, 120],
    actions: data.actions || [],
  };

  const tasks = [self.registration.showNotification(title, options)];
  if ('setAppBadge' in self.navigator) tasks.push(self.navigator.setAppBadge());
  event.waitUntil(Promise.all(tasks));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || APP_URL;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.startsWith(APP_URL) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Open new tab
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});
