const CACHE_VERSION = '2026-02-17-01';
const CACHE_NAME = `marilao-relief-map-${CACHE_VERSION}`;
const urlsToCache = [
  './',
  './index.html',
  './styles.css',
  './script_clean.js',
  './manifest.json',
  './firebase-config.js',
  './firebase-chat-config.js',
  './env-loader.js'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(async (cache) => {
        console.log('Service Worker: Caching files');
        const results = await Promise.allSettled(urlsToCache.map((url) => cache.add(url)));
        const failed = results
          .map((result, index) => ({ result, url: urlsToCache[index] }))
          .filter(({ result }) => result.status === 'rejected');

        if (failed.length > 0) {
          console.warn('Service Worker: Some cache entries failed', failed.map((f) => f.url));
        }
      })
      .catch((error) => {
        console.error('Service Worker: Cache failed', error);
      })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('Service Worker: Clearing old cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip Firebase and external API requests - always fetch from network
  if (
    request.url.includes('firestore.googleapis.com') ||
    request.url.includes('firebase') ||
    request.url.includes('googleapis.com') ||
    request.url.includes('gstatic.com') ||
    request.method !== 'GET'
  ) {
    event.respondWith(fetch(request));
    return;
  }

  // Network-first strategy for navigation and HTML
  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  // Stale-while-revalidate for static assets (CSS/JS/images)
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'error') {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return networkResponse;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// Background sync for offline data submission
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-relief-data') {
    event.waitUntil(syncReliefData());
  }
});

async function syncReliefData() {
  // This will be called when connection is restored
  console.log('Service Worker: Syncing relief data');
  // The actual sync logic should be in your main script
}

// Push notification support (for future use)
self.addEventListener('push', (event) => {
  const options = {
    body: event.data ? event.data.text() : 'New relief update available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    }
  };

  event.waitUntil(
    self.registration.showNotification('Marilao Relief Map', options)
  );
});
