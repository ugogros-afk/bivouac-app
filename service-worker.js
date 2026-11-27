const CACHE_NAME = 'bivouac-v33';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './manifest.json',
  './spots-data.js',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css',
  'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js',
  'https://unpkg.com/@supabase/supabase-js@2'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// App shell: cache-first (fonctionne hors-ligne).
// Overpass (données carte): network-first, jamais mis en cache (données changeantes).
self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  if (url.includes('overpass')) return; // laisser passer normalement, pas de cache

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
