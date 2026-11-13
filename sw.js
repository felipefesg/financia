const VERSAO = 'financia-v9';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './assets/fonts.css', './assets/geist.woff2', './assets/geist-mono.woff2', './assets/apple-touch-icon.png', './assets/icon-192.png', './assets/icon-512.png', './assets/icon-maskable-512.png'];

self.addEventListener('install', e => { e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting())); });

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  const requestUrl = new URL(e.request.url);
  if (requestUrl.origin !== self.location.origin) {
    return e.respondWith(fetch(e.request));
  }

  e.respondWith(
    fetch(e.request).then(r => {
      const c = r.clone();

      if (new URL(e.request.url).origin === location.origin) {
        caches.open(VERSAO).then(ch => ch.put(e.request, c));
      }
      return r;
    })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
