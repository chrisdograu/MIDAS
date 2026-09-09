// MIDIAS — service worker mínimo, mas real (não se auto-desregistra).
// Estratégia:
//  - precache leve do app shell na instalação
//  - network-first para navegação (HTML) com fallback ao cache
//  - stale-while-revalidate para estáticos same-origin (JS/CSS/imagem)
//  - nada de cache para requisições a APIs externas (Supabase, etc.)
const VERSION = 'midias-v2';
const APP_SHELL = ['/', '/manifest.json', '/pwa-192.png', '/pwa-512.png', '/favicon.ico'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    try { await cache.addAll(APP_SHELL); } catch {}
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Só same-origin — nunca cachear chamadas a Supabase/APIs externas.
  if (url.origin !== self.location.origin) return;

  // Navegações (HTML) → network-first
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        const cache = await caches.open(VERSION);
        cache.put(req, res.clone());
        return res;
      } catch {
        const cache = await caches.open(VERSION);
        const cached = await cache.match(req) || await cache.match('/');
        return cached || Response.error();
      }
    })());
    return;
  }

  // Estáticos → stale-while-revalidate
  if (['style','script','image','font'].includes(req.destination)) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req);
      const fetchPromise = fetch(req).then(res => { cache.put(req, res.clone()); return res; }).catch(() => cached);
      return cached || fetchPromise;
    })());
  }
});
