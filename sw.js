/* Ground Truth — cache-first service worker.
   GitHub Pages serves every asset with Cache-Control: max-age=600, so repeat
   visits revalidate everything after 10 minutes. This worker makes repeat
   visits nearly free: same-origin assets/ are served from cache first, while
   the HTML shell stays network-first with a cache fallback so deploys
   propagate. Bump SW_VERSION on every deploy to force an update. */

var SW_VERSION = '2026-08-16-5';
var CACHE_PREFIX = 'groundtruth-';
var ASSET_CACHE = CACHE_PREFIX + 'assets-' + SW_VERSION;
var SHELL_CACHE = CACHE_PREFIX + 'shell-' + SW_VERSION;

/* Universal core: assets every visitor loads unconditionally. The conditional
   bundles (mobile-motion, neural-lite, neural-background, fluid-cursor,
   three.slim, mo, splitting, ScrollTrigger) are gated by __bgMode /
   __canDepthDrill / touch / reduced-motion and must NOT be precached — a
   bgMode:'lite' phone would otherwise download ~400KB of WebGL bundles it will
   never execute. Entries MUST carry the same ?v= stamp the page requests:
   cache.addAll keys on the exact request URL, so an unstamped precache entry
   would never match the stamped runtime fetch. scripts/check-sw-sync.mjs
   enforces stamp parity at release time. */
var CORE_ASSETS = [
  './assets/css/style.min.css?v=22',
  './assets/vendor/gsap.min.js',
  './assets/js/hero-flow.min.js?v=11',
  './assets/js/script.min.js?v=12',
  './assets/fonts/aldrich.woff2',
  './assets/fonts/Switzer-Regular.woff2',
  './assets/fonts/Switzer-Medium.woff2',
  './assets/fonts/MartianMono-Regular.woff2',
  './assets/img/favicon.svg'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(SHELL_CACHE).then(function (cache) {
      return cache.addAll(['./', './404.html']);
    }).then(function () {
      /* Best-effort: one failing precache entry must not block the shell
         install (addAll is atomic — on any failure nothing is added). */
      return caches.open(ASSET_CACHE).then(function (cache) {
        return cache.addAll(CORE_ASSETS).catch(function () {});
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (key) {
      if (key.indexOf(CACHE_PREFIX) === 0 && key !== ASSET_CACHE && key !== SHELL_CACHE) return caches.delete(key);
    }));
  }));
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  var url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  /* Versioned static assets: cache-first, then network (falls back to the
     cached copy on failure). */
  if (url.pathname.indexOf('/assets/') === 0) {
    event.respondWith(
      caches.match(event.request).then(function (cached) {
        if (cached) return cached;
        return fetch(event.request).then(function (response) {
          if (response && response.status === 200 && response.type === 'basic') {
            var copy = response.clone();
            caches.open(ASSET_CACHE).then(function (cache) { cache.put(event.request, copy); });
          }
          return response;
        }).catch(function () {
          return caches.match(event.request);
        });
      })
    );
    return;
  }

  /* HTML shell: network-first with cache fallback + cache update. */
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html' || url.pathname === '/404.html') {
    event.respondWith(
      fetch(event.request).then(function (response) {
        if (response && response.status === 200) {
          var copy = response.clone();
          caches.open(SHELL_CACHE).then(function (cache) { cache.put(event.request, copy); });
        }
        return response;
      }).catch(function () {
        return caches.match(event.request).then(function (cached) {
          if (cached) return cached;
          return caches.match('./');
        });
      })
    );
  }
});
