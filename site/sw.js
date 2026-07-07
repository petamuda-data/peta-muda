// Peta MUDA service worker — network-first everywhere, cache fallback offline.
// Data refreshes every 4 hours (and fast on results night), so nothing may be
// served stale while online; the cache exists purely for doorstep dead zones.
const CACHE = 'pm-v1'
const PRECACHE = [
  './',
  'index.html',
  'app.js',
  'styles.css',
  'ops-match.mjs',
  'manifest.webmanifest',
  'data/index.json',
  'data/johor_dun.geojson',
]

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()))
})

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return
  e.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      })
      .catch(() => caches.match(request, { ignoreSearch: false })
        .then((hit) => hit || (request.mode === 'navigate' ? caches.match('index.html') : Response.error()))))
})
