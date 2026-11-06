/**
 * OrbitGuard Service Worker (Phase 6 PWA Offline Resilience)
 * ==========================================================
 * Provides cache-first and stale-while-revalidate caching for:
 * - App shell (HTML, CSS, JS bundles)
 * - NASA Blue Marble & Earth night textures
 * - Offline cached orbital catalogs (data/catalog.json & data/meta.json)
 */

const CACHE_NAME = 'orbitguard-cache-v4.2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.ico',
  '/textures/earth_daymap.jpg',
  '/textures/earth_nightmap.jpg',
  '/textures/earth_clouds.jpg',
  '/data/catalog.json',
  '/data/meta.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[OrbitGuard SW] Pre-caching static assets & offline catalog snapshot');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[OrbitGuard SW] Pre-cache non-fatal asset fetch error:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[OrbitGuard SW] Pruning outdated cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET and chrome-extension/external API requests
  if (event.request.method !== 'GET') return;
  if (!url.origin.includes(self.location.origin) && !url.hostname.includes('celestrak')) {
    return;
  }

  // Stale-While-Revalidate for catalog data & static assets
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(event.request);
      const networkFetch = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fails and we have a cached copy, return it
          return cachedResponse;
        });

      return cachedResponse || networkFetch;
    })
  );
});
