const CACHE = 'bc-0b2ea05c';
const FILES = [
  './',
  'index.html',
  'css/app.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'data/notes-anchors.json',
  'js/config.js',
  'js/cards.js',
  'js/format.js',
  'js/auction.js',
  'js/engine.js',
  'js/advisor-model.js',
  'js/store.js',
  'js/state.js',
  'js/system/index.js',
  'js/system/openings.js',
  'js/ui/dom.js',
  'js/ui/hand-picker.js',
  'js/ui/bidding-box.js',
  'js/ui/advisor.js',
  'js/ui/decoder.js',
  'js/ui/update.js',
  'js/ui/app.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' })))));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'skip') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then((hit) => hit || fetch(event.request)));
});
