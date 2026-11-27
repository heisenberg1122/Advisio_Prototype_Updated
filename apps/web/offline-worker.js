/* The Vite build embeds only public app assets. Private data lives in account-scoped IndexedDB. */
const SHELL = __ADVISIO_OFFLINE_SHELL__;
const ENTRY = __ADVISIO_OFFLINE_ENTRY__;
const CACHE = __ADVISIO_OFFLINE_CACHE__;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      const index = await fetch(
        new Request("/index.html", { cache: "reload" }),
      );
      // FTP publishes assets before index.html. Never install a mixed release.
      if (!index.ok || !(await index.clone().text()).includes(ENTRY))
        throw new Error("Offline release is not ready yet.");
      await cache.addAll(
        SHELL.map((url) => new Request(url, { cache: "reload" })),
      );
      await cache.put("/index.html", index);
      // An updated worker waits for open tabs to close, preserving their loaded release.
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key.startsWith("advisio-shell-") && key !== CACHE)
          await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  // Never cache API responses, uploads, third-party resources, or authenticated documents.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/")
  )
    return;
  if (
    request.mode === "navigate" &&
    (url.pathname.startsWith("/student/") ||
      url.pathname === "/login" ||
      url.pathname === "/dashboard")
  ) {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match("/index.html")) || Response.error();
      }),
    );
  } else if (SHELL.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        return (await cache.match(url.pathname)) || fetch(request);
      })(),
    );
  }
});
