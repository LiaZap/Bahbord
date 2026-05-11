const CACHE = 'bahflow-v2';
const ASSETS = ['/', '/bahflow-favicon-dark.svg', '/bahflow-logo-dark.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Network-first pra evitar dados velhos. Fallback ao cache se offline.
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
