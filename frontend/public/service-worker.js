// GeoTalk Service Worker - Optimized for Standalone PWA
// Version 1.1

const CACHE_NAME = 'geotalk-v1.1';
const RUNTIME_CACHE = 'geotalk-runtime-v1';

// Essential files to cache on install
const PRECACHE_URLS = [
    '/',
    '/dashboard',
    '/manifest.json',
    '/logo192.png',
    '/logo512.png',
];

// Install event - precache essential resources
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker v1.1');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Precaching app shell');
                return cache.addAll(PRECACHE_URLS);
            })
            .then(() => self.skipWaiting())
            .catch((error) => {
                console.error('[SW] Precache failed:', error);
            })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker v1.1');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames
                    .filter((name) => name !== CACHE_NAME && name !== RUNTIME_CACHE)
                    .map((name) => {
                        console.log('[SW] Deleting old cache:', name);
                        return caches.delete(name);
                    })
            );
        }).then(() => {
            console.log('[SW] Service Worker activated');
            return self.clients.claim();
        })
    );
});

// Fetch event - Network First with Cache Fallback
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip WebSocket, Socket.IO, and API calls
    if (
        url.pathname.includes('socket.io') ||
        url.pathname.startsWith('/api/') ||
        url.protocol === 'ws:' ||
        url.protocol === 'wss:'
    ) {
        return;
    }

    // Network First strategy for HTML documents
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then((response) => {
                    const responseClone = response.clone();
                    caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, responseClone);
                    });
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then((cached) => {
                        return cached || caches.match('/');
                    });
                })
        );
        return;
    }

    // Cache First for static assets
    event.respondWith(
        caches.match(request).then((cached) => {
            if (cached) {
                // Return cached and update in background
                fetch(request).then((response) => {
                    caches.open(RUNTIME_CACHE).then((cache) => {
                        cache.put(request, response.clone());
                    });
                }).catch(() => { });
                return cached;
            }

            return fetch(request)
                .then((response) => {
                    if (response.status === 200) {
                        const responseClone = response.clone();
                        caches.open(RUNTIME_CACHE).then((cache) => {
                            cache.put(request, responseClone);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    if (request.mode === 'navigate') {
                        return caches.match('/');
                    }
                });
        })
    );
});

// Message handler
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});

console.log('[SW] Service Worker v1.1 loaded');
