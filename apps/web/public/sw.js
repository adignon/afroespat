/*
 * Service worker — notifications Web Push (12 §2.4).
 *
 * Il ne fait QUE deux choses, et rien ne met en cache : le produit sert des données
 * personnelles, qu'aucun cache hors ligne ne doit conserver.
 *
 *   · `push` : affiche titre + corps court + lien. La charge est celle que compose
 *     `notifications.service.ts` — jamais le corps d'un message privé (12 §2.4).
 *     Une charge illisible n'affiche RIEN d'inventé : une notification générique
 *     vaut mieux qu'un titre « undefined », mais Chrome EXIGE d'en afficher une
 *     pour tout push, d'où le texte neutre.
 *   · `notificationclick` : focalise l'onglet ouvert sur le même site, ou en ouvre un.
 *     Le lien n'est suivi QUE s'il est relatif à ce site (« /… », pas « //… ») : une
 *     charge forgée ne doit pas pouvoir envoyer ailleurs.
 */
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_error) {
    data = {};
  }
  const title = typeof data.title === 'string' && data.title !== '' ? data.title : 'Nouvelle notification';
  const body = typeof data.body === 'string' ? data.body : '';
  const url = typeof data.url === 'string' && /^\/(?!\/)/.test(data.url) ? data.url : '/notifications';
  event.waitUntil(self.registration.showNotification(title, { body, data: { url }, tag: url }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
