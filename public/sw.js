const CACHE_NAME = "devis-ia-v16";

const STATIC_ASSETS = [
  "/offline.html",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-maskable-512x512.png",
  "/ocr/worker.min.js",
  "/ocr/tesseract-core-lstm.wasm.js",
  "/ocr/tesseract-core-lstm.wasm",
  "/ocr/fra.traineddata.gz",
];

function rscCacheKey(request) {
  const requestUrl = new URL(request.url);
  requestUrl.searchParams.delete("_rsc");

  const routingHeaders = [
    "RSC",
    "Next-Url",
    "Next-Router-State-Tree",
    "Next-Router-Prefetch",
    "Next-Router-Segment-Prefetch",
  ];
  const routingState = routingHeaders
    .map((name) => `${name}:${request.headers.get(name) ?? ""}`)
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < routingState.length; index++) {
    hash ^= routingState.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  requestUrl.searchParams.set("__offline_rsc", (hash >>> 0).toString(16));
  return new Request(requestUrl, { method: "GET" });
}

// Installation et pré-chargement des ressources statiques critiques
self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      await Promise.allSettled(
        STATIC_ASSETS.map(async (url) => {
          try {
            const res = await fetch(url);
            if (res && res.status === 200) {
              await cache.put(url, res);
            } else {
              console.warn("[SW] Impossible de précacher la ressource :", url, res?.status);
            }
          } catch (error) {
            console.warn("[SW] Échec du précache :", url, error);
          }
        })
      );
    })()
  );
  self.skipWaiting();
});

// Nettoyage immédiat des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache.startsWith("devis-ia-") && cache !== CACHE_NAME) {
            console.log("[SW] Suppression de l'ancien cache :", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Gestion des requêtes réseau & stratégies de mise en cache
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Ignorer les requêtes non-HTTP(S) et les outils de dev / Supabase
  if (!url.protocol.startsWith("http")) return;
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/api/auth") ||
    url.hostname.includes("supabase.co")
  ) {
    return;
  }

  // Never fabricate success for a failed mutation. Offline writes must be
  // persisted by the explicit IndexedDB form handlers and replayed by the app.
  if (event.request.method !== "GET") return;

  // Keep the network authoritative while online; only use cached assets if
  // the request fails so an old bundle cannot freeze an updated application.
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/ocr/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".wasm");

  if (isStaticAsset) {
    event.respondWith(
      (async () => {
        let networkResponse;
        try {
          networkResponse = await fetch(event.request);
        } catch (error) {
          const cachedResponse = await caches.match(event.request);
          if (cachedResponse) return cachedResponse;
          throw error;
        }

        if (networkResponse.status === 200) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, networkResponse.clone());
          } catch (error) {
            console.warn("[SW] Échec du cache de la ressource:", error);
          }
        }
        return networkResponse;
      })()
    );
    return;
  }

  // 2. Requêtes Next.js RSC Data (?_rsc=... ou header RSC) -> Network First avec fallback cache
  const isRSCRequest =
    url.searchParams.has("_rsc") ||
    event.request.headers.get("RSC") === "1" ||
    event.request.headers.get("Next-Router-Prefetch") === "1";

  if (isRSCRequest) {
    const cacheKey = rscCacheKey(event.request);
    event.respondWith(
      (async () => {
        let networkResponse;
        try {
          networkResponse = await fetch(event.request);
        } catch {
          const cached = await caches.match(cacheKey);
          if (cached) return cached;
          return new Response(null, { status: 503, statusText: "Offline" });
        }

        if (networkResponse.status === 200) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(cacheKey, networkResponse.clone());
          } catch (error) {
            console.warn("[SW] Échec du cache de la page:", error);
          }
        }
        return networkResponse;
      })()
    );
    return;
  }

  // 3. Navigation de pages HTML and explicit HTML prefetch -> Network First.
  const requestsHtml =
    event.request.mode === "navigate" ||
    event.request.headers.get("Accept")?.includes("text/html");

  if (requestsHtml) {
    event.respondWith(
      (async () => {
        let networkResponse;
        try {
          networkResponse = await fetch(event.request);
        } catch {
          const cached =
            (await caches.match(event.request)) || (await caches.match(url.pathname));
          if (cached) return cached;

          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;

          return fetch("/offline.html", { cache: "no-store" }).catch(() => {
            return new Response("Mode hors-ligne Devis IA", {
              status: 200,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          });
        }

        if (networkResponse.status === 200 && !networkResponse.redirected) {
          try {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, networkResponse.clone());
            await cache.put(url.pathname, networkResponse.clone());
          } catch (error) {
            console.warn("[SW] Échec du cache de la page:", error);
          }
        }
        return networkResponse;
      })()
    );
    return;
  }
});

    // Handler pour Background Sync: demander au client principal de lancer la synchro
    self.addEventListener('sync', (event) => {
      if (event.tag === 'devisia-sync') {
        event.waitUntil((async () => {
          try {
            // Demander à tous les clients (fenêtres) de lancer la sync côté client
            const clientList = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
            for (const client of clientList) {
              try {
                client.postMessage({ type: 'DEVISIA_SYNC' });
              } catch (e) {
                // ignore
              }
            }

            // Optionnel: tenter un replay côté SW en lisant la sync_queue
            // pour les environnements qui préfèrent que le SW fasse le travail.
            try {
              const req = indexedDB.open('DevisIA_OfflineDB', 5);
              req.onsuccess = function () {
                const db = req.result;
                const tx = db.transaction('sync_queue', 'readonly');
                const store = tx.objectStore('sync_queue');
                const getAll = store.getAll();
                getAll.onsuccess = async function () {
                  const items = getAll.result || [];
                  for (const it of items) {
                    try {
                      // Si une API REST existe côté serveur, on pourrait faire un fetch ici.
                      // Ici on préfère laisser le client faire la sync via Server Actions.
                    } catch (e) {
                      // ignore
                    }
                  }
                };
              };
            } catch (e) {
              // ignore
            }
          } catch (err) {
            console.error('SW sync handler failed', err);
          }
        })());
      }
    });
