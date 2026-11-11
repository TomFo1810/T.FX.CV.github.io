/* Logéo : réseau d'abord, copie locale en secours. L'application reste consultable hors ligne avec les dernières annonces vues. */
var CACHE = "logeo-3";
var DISTANT = "https://raw.githubusercontent.com/";
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(["./", "app.css", "app.js", "contenu.js", "regies.js", "communes-geo.js", "vendor/leaflet.js", "vendor/leaflet.css", "fonts/geist-latin-wght-normal.woff2", "icon.svg", "manifest.webmanifest"]); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) { return Promise.all(ks.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); })); }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var r = e.request, u = new URL(r.url);
  if (r.method !== "GET" || (u.origin !== location.origin && r.url.indexOf(DISTANT) !== 0)) return;
  var cle = u.origin + u.pathname;                       // sans le paramètre anti-cache
  e.respondWith(fetch(r).then(function (rep) {
    if (rep.ok) { var copie = rep.clone(); caches.open(CACHE).then(function (c) { c.put(cle, copie); }); }
    return rep;
  }).catch(function () { return caches.match(cle).then(function (m) { return m || Response.error(); }); }));
});
