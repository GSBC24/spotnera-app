const CACHE_PREFIX = "spotnera-static-";
const CACHE_NAME = `${CACHE_PREFIX}v2`;
const PRECACHE_URLS = [
  "/offline.html",
  "/icons/logo.png",
  "/icons/spotnera-favicon.png",
  "/icons/apple-touch-icon.png",
  "/icons/spotnera-icon-192.png",
  "/icons/spotnera-icon-512.png",
  "/icons/spotnera-maskable-192.png",
  "/icons/spotnera-maskable-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) =>
        Promise.all(
          cacheNames
            .filter(
              (cacheName) =>
                cacheName.startsWith(CACHE_PREFIX) && cacheName !== CACHE_NAME,
            )
            .map((cacheName) => caches.delete(cacheName)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches
          .open(CACHE_NAME)
          .then((cache) => cache.match("/offline.html")),
      ),
    );
    return;
  }

  const isSpotneraPrecacheAsset = PRECACHE_URLS.includes(url.pathname);

  if (!isSpotneraPrecacheAsset) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cachedResponse = await cache.match(request);

      if (cachedResponse) {
        return cachedResponse;
      }

      const networkResponse = await fetch(request);

      if (networkResponse.ok && networkResponse.type === "basic") {
        await cache.put(request, networkResponse.clone());
      }

      return networkResponse;
    }),
  );
});
