/* MIDFLOW service worker — offline app shell.
 * Built by the `pwa` plugin in vite.config.ts, which fills in the version and the precache list.
 * - App shell (index.html, hashed JS/CSS/fonts, icons): precached on install, so every route opens offline.
 * - index.html: network-first, so a new deploy is picked up on the next visit.
 * - Hashed assets and photos: cache-first (file names change when content changes).
 * - /api/*: never cached (generation, rewrite and image calls always go to the network).
 * Saved work (brand, generations, library) lives in localStorage and is available offline already.
 */
const VERSION = __VERSION__
const PRECACHE = __PRECACHE__
const CACHE = `midflow-${VERSION}`

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('midflow-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin || url.pathname.includes('/api/')) return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) caches.open(CACHE).then((c) => c.put('./', res.clone()))
          return res
        })
        .catch(() => caches.match('./', { ignoreSearch: true, ignoreVary: true }).then((r) => r || Response.error())),
    )
    return
  }

  if (url.pathname.includes('/assets/') || url.pathname.includes('/icons/')) {
    event.respondWith(
      // ignoreVary: module scripts and fonts are requested with an Origin header the precache request lacked.
      caches.match(req, { ignoreVary: true }).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone()
              caches.open(CACHE).then((c) => c.put(req, copy))
            }
            return res
          }),
      ),
    )
  }
})
