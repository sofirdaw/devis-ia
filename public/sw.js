const CACHE_NAME = "devis-ia-v5";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/quotes",
  "/quotes/new",
  "/quotes/ai",
  "/invoices",
  "/invoices/new",
  "/invoices/ai",
  "/clients",
  "/products",
  "/suppliers",
  "/suppliers/new",
  "/receivables",
  "/settings",
  "/setup",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.ico",
];

// Inscription et préchargement du cache
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Mise en cache statique partielle:", err);
      });
    })
  );
  self.skipWaiting();
});

// Nettoyage des anciens caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Stratégie ultra-rapide par type de ressource
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Ignorer les requêtes de dev HMR WebSocket et Supabase Auth en direct
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/api/auth") ||
    url.hostname.includes("supabase.co")
  ) {
    return;
  }

  // 1. Assets Statiques & Chunks JS/CSS/Fonts -> CACHE-FIRST
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

  // 2. Next.js RSC Data & Prefetches (requêtes ?_rsc=... ou header rsc)
  const isRSCRequest =
    url.searchParams.has("_rsc") ||
    event.request.headers.get("RSC") === "1" ||
    event.request.headers.get("Next-Router-Prefetch") === "1";

  if (isRSCRequest) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(async () => {
          const cached = await caches.match(event.request);
          if (cached) return cached;
          // Si hors-ligne et RSC manquant, renvoyer une réponse vide valide
          return new Response("", {
            status: 200,
            headers: { "Content-Type": "text/x-component" },
          });
        })
    );
    return;
  }

  // 3. Navigation de pages -> Stale-While-Revalidate avec Fallback Cache Shell
  if (event.request.mode === "navigate") {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const networkFetch = fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(async () => {
            if (cachedResponse) return cachedResponse;

            // Fallback de navigation SPA pour rester dans l'application
            const fallback =
              (await caches.match(url.pathname)) ||
              (await caches.match("/dashboard")) ||
              (await caches.match("/quotes")) ||
              (await caches.match("/"));
            return (
              fallback ||
              new Response("Application hors-ligne", {
                status: 200,
                headers: { "Content-Type": "text/html; charset=utf-8" },
              })
            );
          });

        return cachedResponse || networkFetch;
      })
    );
    return;
  }
});

