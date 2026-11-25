const CACHE = 'petits-liens-v19';
const FILES = ['./', './index.html', './style.css', './app.js', './lib.js', './export.js', './vendor/write-excel-file.min.js', './data.json', './source.json', './manifest.webmanifest', './icon.svg', './icon-180.png', './icon-192.png', './icon-512.png', './input/20261120-liste-Asmat-internet.pdf'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(url => new Request(url, { cache: 'reload' })))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('petits-liens-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
});
