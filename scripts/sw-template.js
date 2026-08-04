// Cache name is stamped with a build version at build time (scripts/stamp-sw.mjs).
// Changing the name on each build ensures browsers detect a new SW and bust stale caches.
const CACHE = '__BUILD_VERSION__';

const PRECACHE = [
  '/',
  '/manifest.json',
  '/icon.svg',
  '/icon-192x192.png',
  '/icon-512x512.png',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE).then(cache => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache Next.js chunks, RSC payloads, or API responses. Serving stale
  // chunks can break Turbopack module factories after deploys.
  if (url.pathname.startsWith('/_next/') || url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for public assets: always try to get the latest, fall back to
  // cache only when offline.
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
