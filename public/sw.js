const CACHE = "instox-static-v2";
const PRECACHE = ["/offline.html", "/manifest.webmanifest", "/brand/wordmark.svg", "/icons/icon-192.png", "/icons/icon-512.png"];
const STATIC_EXT = /\.(?:png|svg|ico|webp|woff2)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/admin")) return;
  if (url.pathname.startsWith("/home")) return;
  if (url.pathname.startsWith("/tips")) return;
  if (url.pathname.startsWith("/profile")) return;
  if (url.pathname.startsWith("/sign-in")) return;
  if (url.pathname.startsWith("/screener")) return;
  if (url.pathname.startsWith("/insights")) return;
  if (url.pathname.startsWith("/pulse")) return;
  if (url.pathname.startsWith("/referrals")) return;
  if (url.pathname.startsWith("/shop")) return;
  if (url.pathname.startsWith("/notifications")) return;
  if (url.pathname.startsWith("/charts")) return;
  if (url.pathname.startsWith("/strategies")) return;
  if (url.pathname.startsWith("/backtest")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (!STATIC_EXT.test(url.pathname)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      });
    }),
  );
});

self.addEventListener("push", (event) => {
  let payload = { title: "Instox", body: "Open Instox for the update.", url: "/home" };
  try {
    if (event.data) {
      const parsed = event.data.json();
      payload = {
        title: typeof parsed.title === "string" ? parsed.title : payload.title,
        body: typeof parsed.body === "string" ? parsed.body : payload.body,
        url: typeof parsed.url === "string" ? parsed.url : payload.url,
      };
    }
  } catch {
    payload = { title: "Instox", body: "Open Instox for the update.", url: "/home" };
  }
  event.waitUntil(self.registration.showNotification(payload.title, { body: payload.body, data: { url: payload.url } }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/home";
  event.waitUntil(self.clients.openWindow(url));
});
