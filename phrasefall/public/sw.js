/**
 * Phrasefall service worker — offline play after the first visit.
 *
 *   install   precache the whole build (the list below is written in at build
 *             time by vite.config.js) into a cache named after the build
 *   activate  delete the caches of older builds and take over open pages
 *   fetch     hashed files in /assets/  → cache first (their names change with their content)
 *             page loads (navigation)  → network first, falling back to the cached page
 *                                        when offline or after 4 s on a slow connection
 *             other files of ours      → network first, cache when offline
 *             other sites (Firebase, Google sign-in) and /__/ (Firebase Hosting) → not touched
 *
 * Registered by sw-register.js, which the production build adds to index.html
 * (not in dev, not in the single-file build).
 */
const BUILD = { version: 'dev', files: [] }; // replaced at build time
const PREFIX = 'phrasefall-';
const CACHE = PREFIX + BUILD.version;
const SHELL = './';
const EXTRAS = ['manifest.webmanifest', 'sw-register.js', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-192.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png'];
const SLOW_NETWORK_MS = 4000;
// our files only, all same-origin: a Vary header (e.g. Vary: Origin on module scripts) must not cause a miss
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // The page and the build itself must all arrive, or this version does not install.
      // The page is always fetched fresh. Files in assets/ have hashed names and never change,
      // so the copies the page has just downloaded (the browser's HTTP cache) are used instead of
      // downloading them a second time.
      const fresh = (url) => !url.startsWith('assets/');
      await cache.addAll([SHELL, ...BUILD.files].map((url) => new Request(url, { cache: fresh(url) ? 'reload' : 'default' })));
      await Promise.all(EXTRAS.map((url) => cache.add(new Request(url, { cache: 'reload' })).catch(() => {})));
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const scope = new URL(self.registration.scope);
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname) || url.pathname.startsWith('/__/')) return;
  if (req.mode === 'navigate') event.respondWith(page(event, url, scope));
  else if (url.pathname.includes('/assets/')) event.respondWith(cacheFirst(req));
  else event.respondWith(networkFirst(req));
});

/** The game page: fresh from the network when possible, the cached copy when not. */
async function page(event, url, scope) {
  const cache = await caches.open(CACHE);
  const isShell = url.pathname === scope.pathname || url.pathname === `${scope.pathname}index.html`;
  const network = fetch(event.request).then((res) => {
    if (res.ok && isShell) cache.put(SHELL, res.clone());
    return res;
  });
  event.waitUntil(network.then(() => {}, () => {}));
  const cached = isShell ? await cache.match(SHELL, MATCH) : null;
  if (!cached) return network;
  const slow = new Promise((resolve) => setTimeout(() => resolve(cached), SLOW_NETWORK_MS));
  return Promise.race([network.catch(() => cached), slow]);
}

async function cacheFirst(req) {
  const hit = await caches.match(req, MATCH);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res.ok) (await caches.open(CACHE)).put(req, res.clone());
    return res;
  } catch (err) {
    const hit = await caches.match(req, { ...MATCH, ignoreSearch: true });
    if (hit) return hit;
    throw err;
  }
}
