/* The service worker: lets Learn & Play be installed on a phone and work without internet.
   When it installs, it reads index.html and keeps a copy of every script, stylesheet and icon it names,
   so every game and subject opens offline straight away, not only the ones played before.
   After that every file is fetched fresh from the network when there is one (so updates show up straight
   away), and the copy is refreshed; offline, the kept copy is used. */
const CACHE = "learn-and-play-v3";

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const files = ["./", "index.html", "manifest.webmanifest", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-maskable-512.png", "icons/apple-touch-icon.png"];
    try {
      const html = await (await fetch("index.html", { cache: "no-cache" })).text();
      for (const m of html.matchAll(/(?:src|href)="([^"#:?]+\.(?:js|css|png|webmanifest))"/g)) files.push(m[1]);
    } catch (err) { /* offline while installing: the files are kept as they are used instead */ }
    // one by one, so a single missing file doesn't stop the rest
    await Promise.all([...new Set(files)].map(f => c.add(new Request(f, { cache: "no-cache" })).catch(() => {})));
    await self.skipWaiting();
  })());
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        if (res.ok || res.type === "opaque") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }).then(hit => hit || (e.request.mode === "navigate" ? caches.match("./") : undefined)))
  );
});
