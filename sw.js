const CACHE_VERSION = 'v10'; // Change this to invalidate old caches
const CACHE_NAMES = {
  static: `netflix-static-${CACHE_VERSION}`,
  image: `netflix-images-${CACHE_VERSION}`,
  dynamic: `netflix-dynamic-${CACHE_VERSION}`
};

const APP_ASSETS = [
  './',
  './index.html',
  './style.css',
  './js/app.js',
  './js/db.js',
  './js/router.js',
  './manifest.json',
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Roboto:wght@300;400;700&display=swap'
];

// --- 1. INSTALL ---
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAMES.static)
      .then(cache => cache.addAll(APP_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// --- 2. ACTIVATE (Cleanup) ---
self.addEventListener('activate', event => {
  console.log('[SW] Activating & Cleaning up...');
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          //Delete old caches
          const isOurCache = Object.values(CACHE_NAMES).includes(key);
          if (!isOurCache) {
            console.log('[SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// --- 3. FETCH (Decision Tree Strategy) ---
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Не перехоплювати CDN та зовнішні сервіси (CORS / opaque response)
  if (
    url.origin.includes('unpkg.com') ||
    url.origin.includes('openstreetmap.org') ||
    url.origin.includes('nominatim.openstreetmap.org')
  ) {
    return;
  }

  //  Ignore non - GET requests(e.g., POST to the server)
  if (request.method !== 'GET') return;

  // 2. Google Fonts & CSS/JS -> Cache First (Static)
  if (
    url.origin.includes('fonts.googleapis.com') ||
    url.origin.includes('fonts.gstatic.com') ||
    request.destination === 'style' ||
    request.destination === 'script'
  ) {
    event.respondWith(cacheFirst(request, CACHE_NAMES.static));
    return;
  }

  // 3. Images -> Stale While Revalidate
  if (request.destination === 'image') {
    event.respondWith(staleWhileRevalidate(request, CACHE_NAMES.image));
    return;
  }

  // 4. HTML pages -> Network First for fresh content

  if (request.destination === 'document') {
    event.respondWith(networkFirst(request, CACHE_NAMES.dynamic));
    return;
  }

  // 5. Everything else -> also Cache First (for security and speed)
  event.respondWith(cacheFirst(request, CACHE_NAMES.static));
});

// --- STRATEGIES (Helper Functions) ---

// Strategia: Cache First, falling back to Network
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  if (cachedResponse) {
    return cachedResponse;
  }

  try {
    const networkResponse = await fetch(request);
    cache.put(request, networkResponse.clone());
    return networkResponse;
  } catch (error) {
    console.log('Fetch failed for:', request.url);
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

// Strategia: Network First, falling back to Cache
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName);

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('Network failed, trying cache:', request.url);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    return new Response('You are offline and no cache available.', { status: 503 });
  }
}

// Strategy: Stale While Revalidate 
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  const fetchPromise = fetch(request).then(async (networkResponse) => {
    if (networkResponse.ok) {
      await cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch(err => console.log('Background update failed', err));

  return cachedResponse || fetchPromise;
}