// Offline support: the app shell is cached on first visit; fonts and the receipt reader are cached the first time they load.
const VERSION = 'avocado-v3';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/analytics.js',
  './js/categories.js',
  './js/charts.js',
  './js/dates.js',
  './js/db.js',
  './js/debts.js',
  './js/demo.js',
  './js/engine.js',
  './js/format.js',
  './js/game.js',
  './js/receipt.js',
  './js/sheets.js',
  './js/store.js',
  './js/ui.js',
  './js/views/activity.js',
  './js/views/add.js',
  './js/views/bills.js',
  './js/views/debts.js',
  './js/views/goals.js',
  './js/views/home.js',
  './js/views/insights.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const RUNTIME = 'avocado-runtime-v1';
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|tessdata\.projectnaptha\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // OCR engine + language data: cache-first (large, versioned files)
  if (CDN.test(req.url)) {
    e.respondWith(
      caches.open(RUNTIME).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin !== location.origin) return;

  // App files: serve from cache instantly, refresh in the background (updates apply on next launch)
  e.respondWith(
    caches.open(VERSION).then(async (c) => {
      const key = req.mode === 'navigate' ? './index.html' : req;
      const hit = await c.match(key, { ignoreSearch: true });
      const net = fetch(req).then((res) => {
        if (res.ok) c.put(key, res.clone());
        return res;
      }).catch(() => null);
      return hit || (await net) || new Response('Offline', { status: 503 });
    })
  );
});
