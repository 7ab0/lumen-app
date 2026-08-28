// Service worker de Lumen — escrito a mano en vez de generado en el
// build (ver next.config.ts para el porqué). Estrategia simple:
// network-first para navegación (con fallback a la última versión en
// caché cuando no hay señal) y cache-first para assets estáticos. Los
// pagos registrados sin conexión NO pasan por este archivo — se
// guardan en IndexedDB desde src/lib/offline-queue.ts y se sincronizan
// vía Server Actions cuando vuelve la señal.

const CACHE_NAME = "lumen-shell-v1";
const CORE_ASSETS = ["/", "/manifest.json"];

self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS).catch(() => {}))
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // No interceptar nada que no sea GET (los Server Actions van por
  // POST) ni llamadas a la API/auth — esas siempre deben ir a la red.
  if (request.method !== "GET" || request.url.includes("/api/")) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
    )
  );
});
