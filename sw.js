// Built by publish.py. VERSION is a hash of the site files, so each release replaces the cached shell.
// Several sites share this address and its caches, so every name here carries this site's prefix.
const PREFIX = 'cook-recipe-';
const VERSION = `${PREFIX}aa4fc4eb5e3c`;
const DATA_CACHE = `${PREFIX}data`;
const SHELL = ["./", "index.html", "style.css", "app.js", "manifest.webmanifest", "icons/icon-180.png", "icons/icon-192.png", "icons/icon-512.png", "fonts/Pretendard-Bold.woff2"];

self.addEventListener('install', (event) => {
  event.waitUntil(
    // GitHub Pages lets browsers keep files for 10 minutes, so ask the server or a new version could store old files.
    caches.open(VERSION)
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key.startsWith(PREFIX) && key !== VERSION && key !== DATA_CACHE).map((key) => caches.delete(key)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Recipes and photos prefer the network so a new publish shows at once, and fall back to the last copy offline.
function networkFirst(request) {
  return fetch(request).then((response) => {
    if (response.ok) {
      const copy = response.clone();
      caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request, { ignoreSearch: true }));
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const { pathname } = new URL(event.request.url);
  if (pathname.includes('/data/') || pathname.includes('/photos/')) {
    event.respondWith(networkFirst(event.request));
    return;
  }
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then((cached) => cached || fetch(event.request)),
  );
});
