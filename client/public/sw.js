// Service Worker IGS Transit & Douane Guinée — Port Autonome de Conakry
const CACHE_NAME = 'igs-transit-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/igs-logo-icon.png',
  '/igs-logo-sidebar.png',
  '/igs-logo-transparent.png',
];

// Installation & Pré-mise en cache des assets vitaux
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activation & Purge des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Stratégies de cache avancées pour conditions 3G/4G intermittentes du Quai de Conakry
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignorer les requêtes non-GET et les requêtes chrome-extension/externes non pertinentes
  if (request.method !== 'GET') {
    return;
  }

  // 1. Stratégie Network-First avec repli Cache pour les requêtes tRPC et API (/api/trpc, /api/*)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Si rien en cache et réseau inaccessible, retourner un payload JSON d'erreur hors-ligne tRPC
          const offlinePayload = [
            {
              error: {
                json: {
                  message: "Mode hors-ligne : Données non synchronisées pour cette ressource.",
                  code: -32603,
                  data: {
                    code: "OFFLINE_MODE",
                    httpStatus: 503,
                  },
                },
              },
            },
          ];
          return new Response(JSON.stringify(offlinePayload), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        })
    );
    return;
  }

  // 2. Stratégie Cache-First pour les assets statiques (JS, CSS, images, polices, logo)
  const isStaticAsset =
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|webp|woff2?|ttf|ico|json)$/i) ||
    STATIC_ASSETS.includes(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Si présent en cache, servir immédiatement et rafraîchir le cache en arrière-plan (Stale-While-Revalidate discret)
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
            }
          }).catch(() => {
            // Ignorer l'erreur réseau silencieusement car on a le cache
          });
          return cachedResponse;
        }

        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseClone);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. Navigation HTML (App Shell fallback)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cachedShell = await caches.match('/index.html');
        if (cachedShell) {
          return cachedShell;
        }
        return caches.match('/');
      })
    );
    return;
  }

  // Stratégie par défaut : Réseau avec secours Cache
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});
