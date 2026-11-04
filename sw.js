const CACHE = 'alphamax-v2';
const IMG_CACHE = 'alphamax-img-v2';
const STATIC = [
  '/',
  '/index.html',
  '/css/store.css',
  '/js/store.js',
  '/js/produtos.js',
  '/logo.png',
  '/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && k !== IMG_CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  // Supabase Storage (imagens): cache-first para parar de queimar egress
  if (url.includes('supabase.co/storage/v1/object/')) {
    e.respondWith(
      caches.open(IMG_CACHE).then(c =>
        c.match(e.request).then(cached =>
          cached || fetch(e.request).then(res => {
            if (res.ok) c.put(e.request, res.clone());
            return res;
          }).catch(() => cached)
        )
      )
    );
    return;
  }

  // Supabase REST, ML e webhooks externos: sempre network-first (sem cache)
  if (url.includes('supabase.co') || url.includes('multizap') || url.includes('/ml-api')) return;

  // Assets estáticos: stale-while-revalidate
  e.respondWith(
    caches.match(e.request).then(cached => {
      const network = fetch(e.request).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put(e.request, res.clone()));
        return res;
      });
      return cached || network;
    })
  );
});
