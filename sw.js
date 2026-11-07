const CACHE_NAME = 'ricettario-cache-v1';

// Installazione ed errore ignorato in caso di file mancanti per non bloccare l'installazione PWA
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Gestione standard delle richieste di rete
    event.respondWith(
        fetch(event.request).catch(() => {
            return caches.match(event.request);
        })
    );
});