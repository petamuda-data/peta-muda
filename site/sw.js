// Self-destruct service worker.
//
// Earlier builds shipped a caching SW that, combined with the CDN's HTTP cache,
// pinned stale shells to devices — the app kept showing old builds. This worker
// exists only to UNDO that: it deletes every cache, unregisters itself, and
// reloads open pages so they load fresh from the network. The app no longer
// registers any SW (see app.js), so once this has run a device is SW-free and
// every future load is a normal network fetch. No fetch handler = it never
// serves a cached byte.
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const key of await caches.keys()) await caches.delete(key)
    await self.registration.unregister()
    const clients = await self.clients.matchAll({ type: 'window' })
    for (const client of clients) client.navigate(client.url)
  })())
})
