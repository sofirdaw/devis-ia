const CACHE_NAME = "devis-ia-v10";

const STATIC_ASSETS = [
  "/offline.html",
  "/favicon.ico",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/icons/icon-maskable-512x512.png",
];

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
            }
          } catch {
            // Ignorer silencieusement si un asset n'est pas encore disponible
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
          if (cache !== CACHE_NAME) {
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

  // Interception des requêtes POST (Server Actions) en cas de perte de connexion
  if (event.request.method === "POST") {
    // Tenter d'envoyer au réseau ; en cas d'échec, stocker la requête
    // dans IndexedDB (sync_queue) pour que le client la synchronise plus tard.
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request.clone());
          return networkResponse;
        } catch (err) {
          try {
            // Lire le corps de la requête (JSON ou texte)
            let body = null;
            try {
              body = await event.request.clone().json();
            } catch (e) {
              try {
                body = await event.request.clone().text();
              } catch (ee) {
                body = null;
              }
            }

            // Stocker dans IndexedDB sync_queue pour la reprise côté client
            await (async function addToSyncQueue(payload) {
              return new Promise((resolve) => {
                const req = indexedDB.open("DevisIA_OfflineDB", 4);
                req.onsuccess = function () {
                  const db = req.result;
                  const tx = db.transaction("sync_queue", "readwrite");
                  const store = tx.objectStore("sync_queue");
                  const item = {
                    id: `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
                    action: payload.action || "CREATE_QUOTE",
                    payload: payload.body ?? {},
                    created_at: new Date().toISOString(),
                  };
                  store.put(item);
                  tx.oncomplete = () => resolve(true);
                  tx.onerror = () => resolve(false);
                };
                req.onerror = () => resolve(false);
              });
            })({
              action: (function guessAction(url) {
                if (url.includes("/quotes")) return "CREATE_QUOTE";
                if (url.includes("/invoices")) return "CREATE_INVOICE";
                return "CREATE_QUOTE";
              })(event.request.url),
              body,
            });
            // Tenter d'enregistrer un Background Sync pour que le SW tente
            // d'appeler l'événement 'sync' lorsque la connectivité revient.
            try {
              if (self.registration && self.registration.sync) {
                await self.registration.sync.register('devisia-sync');
              }
            } catch (e) {
              // Certains navigateurs ne supportent pas SyncManager; OK.
            }
          } catch (dbErr) {
            // Silent fail
            console.warn("SW: impossible d'écrire la sync_queue :", dbErr);
          }

          // Répondre immédiatement côté client pour conserver l'UX en offline
          return new Response(JSON.stringify({ success: true, offline: true }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
      })()
    );
    return;
  }

  // 1. Assets Statiques (JS, CSS, Polices, Images, Icônes) -> Cache-First avec revalidation en arrière-plan
  const isStaticAsset =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".ico") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".wasm");

  if (isStaticAsset) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          // Revalider en arrière-plan
          fetch(event.request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(event.request, networkResponse);
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 2. Requêtes Next.js RSC Data (?_rsc=... ou header RSC) -> Network First avec fallback cache
  const isRSCRequest =
    url.searchParams.has("_rsc") ||
    event.request.headers.get("RSC") === "1" ||
    event.request.headers.get("Next-Router-Prefetch") === "1";

  if (isRSCRequest) {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, responseToCache);
          }
          return networkResponse;
        } catch {
          const cached = await caches.match(event.request);
          if (cached) return cached;

          const cachedBase = await caches.match(url.pathname);
          if (cachedBase) return cachedBase;

          return new Response(null, { status: 503, statusText: "Offline" });
        }
      })()
    );
    return;
  }

  // 3. Navigation de pages HTML -> Network First avec fallback propre
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request, { cache: "no-store" });

          if (networkResponse && networkResponse.ok && !networkResponse.redirected) {
            const responseToCache = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, responseToCache);
            await cache.put(url.pathname, responseToCache.clone());
          }

          return networkResponse;
        } catch {
          const cached =
            (await caches.match(event.request)) || (await caches.match(url.pathname));
          if (cached) return cached;

          const fallback =
            (await caches.match("/dashboard")) ||
            (await caches.match("/quotes")) ||
            (await caches.match("/invoices")) ||
            (await caches.match("/products")) ||
            (await caches.match("/clients")) ||
            (await caches.match("/settings")) ||
            (await caches.match("/login"));

          if (fallback) return fallback;

          const offlinePage = await caches.match("/offline.html");
          if (offlinePage) return offlinePage;

          return fetch("/offline.html", { cache: "no-store" }).catch(() => {
            return new Response("Mode hors-ligne Devis IA", {
              status: 200,
              headers: { "Content-Type": "text/plain; charset=utf-8" },
            });
          });
        }
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
              const req = indexedDB.open('DevisIA_OfflineDB', 4);
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
