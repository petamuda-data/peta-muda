// Peta MUDA service worker.
//
// The shell (HTML/JS/CSS/manifest) is fetched with { cache: 'reload' } so the
// SW ALWAYS revalidates against the network and never re-serves a stale copy
// out of the browser's HTTP cache — the trap that pinned old builds to phones.
// It falls back to the SW cache only when the network is unavailable, so the
// app still opens at the door with no signal. Data (index.json, seats, geojson)
// stays plain network-first: fresh while online, cached copy when offline.
const CACHE = 'pm-v3'
const SHELL = [
  './',
  'index.html',
  'app.js',
  'styles.css',
  'ops-match.mjs',
  'manifest.webmanifest',
]
const DATA = ['data/index.json', 'data/johor_dun.geojson']

// bypass the HTTP cache for shell + data on precache too, so a stale CDN/browser
// cache can't seed the SW cache with old bytes
const reload = (url) => new Request(url, { cache: 'reload' })
const isShell = (req) =>
  req.mode === 'navigate' || /\.(?:js|mjs|css|webmanifest)(?:\?|$)/.test(new URL(req.url).pathname)

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll([...SHELL, ...DATA].map(reload)))
      .then(() => self.skipWaiting()))
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()))
})

// let a new SW take over immediately when the page asks
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting() })

self.addEventListener('fetch', (e) => {
  const { request } = e
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return
  // shell/code: force a network revalidation (bypass HTTP cache), cache only as
  // an offline fallback — this is what keeps a deployed change reaching phones
  const req = isShell(request) ? reload(request.url) : request
  e.respondWith(
    fetch(req)
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
