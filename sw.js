const CACHE = 'bc-40b0820f';
const FILES = [
  './',
  'index.html',
  'css/app.css',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'data/notes-anchors.json',
  'data/notes-toc.json',
  'guide/system-notes.html',
  'guide/convention-card.html',
  'js/config.js',
  'js/cards.js',
  'js/format.js',
  'js/auction.js',
  'js/engine.js',
  'js/general.js',
  'js/judgment.js',
  'js/advisor-model.js',
  'js/store.js',
  'js/state.js',
  'js/system/index.js',
  'js/system/openings.js',
  'js/system/resp-major.js',
  'js/system/resp-minor.js',
  'js/system/rebids.js',
  'js/system/resp-rebids.js',
  'js/system/notrump.js',
  'js/system/twos.js',
  'js/system/slam.js',
  'js/system/round3.js',
  'js/system/competitive.js',
  'js/system/compete-advice.js',
  'js/ui/dom.js',
  'js/ui/hand-picker.js',
  'js/ui/bidding-box.js',
  'js/ui/advisor.js',
  'js/ui/decoder.js',
  'js/ui/update.js',
  'js/table/model.js',
  'js/table/review.js',
  'js/table/sync.js',
  'js/ui/theme.js',
  'js/ui/copy.js',
  'js/ui/notes.js',
  'js/confidence.js',
  'js/ui/conf.js',
  'js/report.js',
  'js/ui/table.js',
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
