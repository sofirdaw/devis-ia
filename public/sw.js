const CACHE_NAME = "devis-ia-v1";
const STATIC_ASSETS = [
  "/",
  "/dashboard",
  "/quotes",
  "/invoices",
  "/clients",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
  "/icons/apple-touch-icon.png",
  "/favicon.ico",
];

// Inscription et mise en cache initiale
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Erreur lors de la mise en cache initiale:", err);
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

// Interception des requêtes avec stratégie réseau en premier, puis cache de secours
self.addEventListener("fetch", (event) => {
  // Ignorer les requêtes non-GET et les requêtes Supabase/API en écriture
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Pour la navigation HTML et les assets statiques
  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Enregistrer la copie fraîche dans le cache si la réponse est valide
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          networkResponse.type === "basic"
        ) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      })
      .catch(() => {
        // Mode Hors-Ligne : servir depuis le cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback pour la navigation de page si non disponible dans le cache
          if (event.request.mode === "navigate") {
            return caches.match("/dashboard") || caches.match("/");
          }
          return new Response("Contenu indisponible hors-ligne", {
            status: 533,
            headers: { "Content-Type": "text/plain" },
          });
        });
      })
  );
});
