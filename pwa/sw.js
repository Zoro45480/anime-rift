// ANIME RIFT : garde le jeu en cache pour l'ouvrir vite, et le met à jour en arrière-plan.
const CACHE = 'anime-rift-v1'
self.addEventListener('install', (e) => { self.skipWaiting(); e.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png']))) })
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())) })
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (e.request.method !== 'GET' || url.origin !== location.origin) return // le serveur de jeu (Supabase) n'est jamais mis en cache
  // réseau d'abord : on a toujours la dernière version ; le cache sert seulement hors connexion
  e.respondWith(fetch(e.request).then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return res }).catch(() => caches.match(e.request)))
})
