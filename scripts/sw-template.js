const CACHE_NAME = __CACHE_NAME__
const SHELL = __SHELL__
const SHELL_PATHS = new Set(SHELL)

self.addEventListener('install', (event) => {
  // A failed download cannot activate an incomplete new shell.
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL)))
})

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys()
    await Promise.all(keys.filter((key) => key.startsWith('wort-shell-') && key !== CACHE_NAME).map((key) => caches.delete(key)))
    await self.clients.claim()
  })())
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)
  if (request.method !== 'GET' || url.origin !== self.location.origin) return
  const path = request.mode === 'navigate' ? '/index.html' : url.pathname
  if (/^\/wordbooks\/[^/]+\.json$/.test(path)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME)
      const saved = await cache.match(path)
      if (saved) return saved
      const response = await fetch(request)
      if (response.ok) await cache.put(path,response.clone())
      return response
    })())
    return
  }
  if (!SHELL_PATHS.has(path)) return
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME)
    return (await cache.match(path)) || fetch(request)
  })())
})
