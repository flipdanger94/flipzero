const CACHE_NAME = "flipzero-shell-v1";
const SHELL = ["/offline", "/favicon.svg", "/pwa-icon-192.svg", "/pwa-icon-512.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline")));
    return;
  }
  const publicAsset = url.pathname.startsWith("/_next/static/") || url.pathname === "/favicon.svg" || url.pathname.startsWith("/pwa-icon-");
  if (publicAsset && ["style", "script", "image", "font"].includes(request.destination)) {
    event.respondWith(caches.match(request).then((cached) => cached || fetch(request).then((response) => { if (response.ok) { const copy = response.clone(); void caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)); } return response; })));
  }
});
