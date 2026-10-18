const CACHE = 'bc-f8f972a2';
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
  'guide/fundamentals.html',
  'js/config.js',
  'js/cards.js',
  'js/format.js',
  'js/auction.js',
  'js/engine.js',
  'js/general.js',
  'js/judgment.js',
  'js/fallback.js',
  'js/advisor-model.js',
  'js/store.js',
  'js/state.js',
  'js/system/index.js',
  'js/system/opening/openings.js',
  'js/system/opening/notrump.js',
  'js/system/opening/twos.js',
  'js/system/responding/major.js',
  'js/system/responding/minor.js',
  'js/system/rebids/opener.js',
  'js/system/rebids/responder.js',
  'js/system/rebids/third-round.js',
  'js/system/rebids/slam.js',
  'js/system/competitive/index.js',
  'js/system/competitive/shared.js',
  'js/system/competitive/when-they-open.js',
  'js/system/competitive/dont.js',
  'js/system/competitive/when-we-open.js',
  'js/system/competitive/over-our-conventions.js',
  'js/system/competitive/penalty-and-lead-doubles.js',
  'js/ui/dom.js',
  'js/ui/hand-picker.js',
  'js/ui/bidding-box.js',
  'js/ui/advisor.js',
  'js/ui/decoder.js',
  'js/ui/update.js',
  'js/table/model.js',
  'js/table/play.js',
  'js/table/dd.js',
  'js/table/dd-worker.js',
  'js/table/ddreview.js',
  'js/table/ddtext.js',
  'js/table/pool.js',
  'js/sim-bid.js',
  'js/sim-advice.js',
  'js/vendor/dds/api.js',
  'js/vendor/dds/dds.js',
  'js/table/review.js',
  'js/table/sync.js',
  'js/ui/theme.js',
  'js/ui/copy.js',
  'js/ui/notes.js',
  'js/proposed.js',
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
