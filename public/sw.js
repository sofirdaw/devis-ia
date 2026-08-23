const CACHE_NAME = "devis-ia-v8";

const STATIC_ASSETS = [
  "/",
  "/login",
  "/register",
  "/forgot-password",
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
  const url = new URL(event.request.url);

  // Ignorer les requêtes de dev HMR WebSocket et Supabase Auth en direct
  if (
    url.pathname.startsWith("/_next/webpack-hmr") ||
    url.pathname.startsWith("/api/auth") ||
    url.hostname.includes("supabase.co")
  ) {
    return;
  }

  // Interception des requêtes POST (Server Actions) en cas de déconnexion réseau
  if (event.request.method === "POST") {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(
          JSON.stringify({ success: true, offline: true }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }
        );
      })
    );
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

  // 3. Navigation de pages -> Robuste sur Safari iOS (gère networkResponse.redirected sans erreur)
  if (event.request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            const cache = await caches.open(CACHE_NAME);
            await cache.put(event.request, responseToCache);
          }

          // Si la réponse réseau est une redirection, créer une réponse 200 propre
          // pour éviter l'erreur WebKit/Safari : "Response served by service worker has redirections"
          if (networkResponse.redirected) {
            const body = await networkResponse.blob();
            return new Response(body, {
              status: 200,
              statusText: "OK",
              headers: networkResponse.headers,
            });
          }

          return networkResponse;
        } catch {
          // En mode hors-ligne : servir depuis le cache
          const cached = await caches.match(event.request);
          if (cached) return cached;

          const fallback =
            (await caches.match(url.pathname)) ||
            (await caches.match("/dashboard")) ||
            (await caches.match("/quotes")) ||
            (await caches.match("/login")) ||
            (await caches.match("/"));

          return (
            fallback ||
            new Response(
              "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Devis IA</title></head><body><script>window.location.href='/dashboard';</script></body></html>",
              {
                status: 200,
                headers: { "Content-Type": "text/html; charset=utf-8" },
              }
            )
          );
        }
      })()
    );
    return;
  }
});



