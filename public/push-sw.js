// Notificações push do Sísifo. Importado pelo service worker gerado pelo
// vite-plugin-pwa (workbox.importScripts em vite.config.ts).

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Sísifo';
  // Número no ícone do app com o que falta hoje (iOS 16.4+ e Android).
  if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
    self.navigator.setAppBadge(data.badge).catch(() => {});
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag,
      icon: '/pwa-192.png',
      badge: '/pwa-192.png',
      lang: 'pt-BR',
      data: { url: data.url || '/' },
    }),
  );
});

// Tocar na notificação: foca uma janela aberta do app (indo para a tela certa) ou abre uma nova.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin && 'focus' in client) {
          return client.navigate(url).then((c) => (c || client).focus());
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
