const CACHE_NAME = "nexora-shell-v1";

const APP_SHELL = [
"./",
"./manifest.json",
"./icons/icon-192.png",
"./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
event.waitUntil(
caches.open(CACHE_NAME)
.then((cache) => cache.addAll(APP_SHELL))
.then(() => self.skipWaiting())
);
});

self.addEventListener("activate", (event) => {
event.waitUntil(
caches.keys()
.then((keys) =>
Promise.all(
keys
.filter((key) => key !== CACHE_NAME)
.map((key) => caches.delete(key))
)
)
.then(() => self.clients.claim())
);
});

self.addEventListener("fetch", (event) => {
const request = event.request;
const url = new URL(request.url);

if (
request.method !== "GET" ||
url.origin !== self.location.origin ||
url.pathname.startsWith("/api/") ||
url.pathname.includes("/rest/") ||
url.pathname.includes("/auth/")
) {
return;
}

if (request.mode === "navigate") {
event.respondWith(
fetch(request)
.then((response) => {
if (response.ok) {
const copy = response.clone();

        caches.open(CACHE_NAME)
          .then((cache) => cache.put("./", copy));
      }

      return response;
    })
    .catch(async () => {
      const cached = await caches.match("./");

      return cached || new Response(
        "Nexora is offline. Please reconnect.",
        {
          status: 503,
          headers: {
            "Content-Type": "text/plain; charset=utf-8"
          }
        }
      );
    })
);

}
});
