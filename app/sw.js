// Offline support.
// App files are NETWORK-FIRST: when you're online you always get the newest version (so updates show up on the
// next open), and the saved copy is only used when you're offline or the network is very slow.
// Fonts and the receipt reader are cache-first (big files that never change).
const VERSION = 'avocado-v6';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/version.js',
  './js/analytics.js',
  './js/categories.js',
  './js/charts.js',
  './js/dates.js',
  './js/db.js',
  './js/debts.js',
  './js/demo.js',
  './js/engine.js',
  './js/format.js',
  './js/nightly.js',
  './js/game.js',
  './js/receipt.js',
  './js/sheets.js',
  './js/tree.js',
  './js/store.js',
  './js/ui.js',
  './js/views/activity.js',
  './js/views/add.js',
  './js/views/bills.js',
  './js/views/debts.js',
  './js/views/goals.js',
  './js/views/home.js',
  './js/views/insights.js',
  './js/views/tree.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
];
const RUNTIME = 'avocado-runtime-v1';
const CDN = /^https:\/\/(cdn\.jsdelivr\.net|tessdata\.projectnaptha\.com|fonts\.googleapis\.com|fonts\.gstatic\.com)\//;
const NET_TIMEOUT = 4000;

self.addEventListener('install', (e) => {
  // cache: 'reload' skips the browser's HTTP cache so a new version never saves old files.
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (e) => {
  if (e.data === 'skipWaiting') self.skipWaiting();
});

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (err) => { clearTimeout(t); reject(err); });
  });
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

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

  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const nav = req.mode === 'navigate';
    const key = nav ? './index.html' : url.pathname;
    try {
      // 'no-cache' = ask the server if the file changed (cheap when it hasn't).
      const res = await withTimeout(fetch(nav ? './index.html' : url.href, { cache: 'no-cache', credentials: 'same-origin' }), NET_TIMEOUT);
      if (res && res.ok) {
        c.put(key, res.clone());
        return res;
      }
      throw new Error('bad response');
    } catch {
      const hit = (await c.match(key)) || (await c.match(req, { ignoreSearch: true }));
      return hit || new Response('Offline and not cached yet', { status: 503 });
    }
  })());
});
