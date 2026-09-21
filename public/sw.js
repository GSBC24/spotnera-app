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

function safeNotificationPath(value) {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.includes("\\")) {
    return "/me";
  }

  try {
    const destination = new URL(value, self.location.origin);
    return destination.origin === self.location.origin ? `${destination.pathname}${destination.search}${destination.hash}` : "/me";
  } catch {
    return "/me";
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data?.json() ?? {};
    } catch {
      // A malformed payload still produces a safe, visible notification.
    }

    const title = typeof payload?.title === "string" && payload.title.trim()
      ? payload.title.slice(0, 120) : "Spotnera";
    const body = typeof payload?.body === "string" && payload.body.trim()
      ? payload.body.slice(0, 240) : "You have a notification from Spotnera.";
    const tag = typeof payload?.tag === "string" && payload.tag.trim()
      ? payload.tag.slice(0, 80) : "spotnera-test";

    await self.registration.showNotification(title, {
      body,
      tag,
      icon: "/icons/spotnera-icon-192.png",
      badge: "/icons/spotnera-icon-192.png",
      data: { path: safeNotificationPath(payload?.url) },
    });
  })());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    const path = safeNotificationPath(event.notification.data?.path);
    const destination = new URL(path, self.location.origin);
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const existing = windows.find((client) => {
      try {
        return new URL(client.url).origin === self.location.origin;
      } catch {
        return false;
      }
    });

    if (existing) {
      try {
        const navigated = await existing.navigate(destination.href);
        if (navigated) {
          await navigated.focus();
          return;
        }
      } catch {
        // If an existing window cannot navigate, open a safe app path instead.
      }
    }

    await self.clients.openWindow(destination.href);
  })());
});
