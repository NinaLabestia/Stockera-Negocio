// Mi Stock - service worker para usar la app sin conexión
// Cada vez que cambies index.html y quieras forzar la actualización, subí el número de VERSION.
var VERSION = 'mistock-v9';
var ARCHIVOS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) {
      // se agrega uno por uno: si falta algún archivo (ej. icon-512.png) no se rompe la instalación
      return Promise.all(ARCHIVOS.map(function (a) { return c.add(a).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (ks) {
      return Promise.all(ks.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    // la tipografía se guarda la primera vez para que funcione sin conexión
    e.respondWith(caches.open(VERSION).then(function (c) {
      return c.match(req).then(function (g) {
        return g || fetch(req).then(function (r) { c.put(req, r.clone()); return r; }).catch(function () { return new Response('', { status: 504 }); });
      });
    }));
    return;
  }
  if (url.origin !== location.origin) return; // lo demás de otros sitios no se toca

  e.respondWith(
    caches.open(VERSION).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (guardado) {
        // abre al toque desde lo guardado y, si hay internet, lo actualiza para la próxima vez
        var red = fetch(req).then(function (r) {
          if (r && r.ok) c.put(req, r.clone());
          return r;
        }).catch(function () { return null; });
        if (guardado) return guardado;
        return red.then(function (r) {
          if (r) return r;
          if (req.mode === 'navigate') return c.match('./index.html');
          return new Response('', { status: 504 });
        });
      });
    })
  );
});
