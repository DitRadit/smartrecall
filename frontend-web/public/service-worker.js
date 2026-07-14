/**
 * service-worker.js - Offline-first caching untuk SmartRecall (siswa).
 *
 * Prinsip (ARCHITECTURE.md bagian 1 & 3.2):
 * - Frontend siswa tidak boleh punya alur yang mengharuskan fetch ke luar
 *   jaringan lokal.
 * - IndexedDB/cache di sini hanya CACHE, bukan source of truth. Data utama
 *   tetap di SQLite via backend-api.
 *
 * Strategi:
 * - App shell (HTML/JS/CSS/asset build Vite): "cache falling back to
 *   network, lalu populate cache". PENTING: nama file JS/CSS hasil build
 *   Vite mengandung hash yang berubah tiap build (mis. /assets/index-XXXX.js),
 *   jadi TIDAK bisa di-precache dengan daftar tetap saat event "install".
 *   Sebagai gantinya, setiap asset yang berhasil di-fetch (saat online, mis.
 *   kunjungan pertama siswa ke app) otomatis disimpan ke cache di sini, agar
 *   kunjungan berikutnya -- termasuk saat Local Server Hub benar-benar mati
 *   total, bukan cuma request API yang gagal -- tetap bisa boot dari cache.
 * - GET /materi, /review, /soal, /rangkuman: network-first dengan fallback
 *   ke cache (supaya data selalu paling baru saat online, tapi tetap bisa
 *   dibaca saat offline).
 * - POST /review, /soal/submit: TIDAK di-cache di sini — kegagalan network
 *   untuk POST ditangani oleh offline queue di src/offline/syncManager.js
 *   (IndexedDB), bukan oleh Service Worker cache biasa.
 */

const CACHE_NAME = 'smartrecall-cache-v2';
const APP_SHELL = ['/', '/index.html', '/manifest.json'];

// Path GET yang datanya berasal dari backend-api (network-first + cache
// fallback). Wajib disinkronkan manual dengan endpoint GET baru yang
// ditambahkan ke API -- lihat ARCHITECTURE.md 3.3 untuk daftar lengkap.
const API_GET_PREFIXES = ['/materi', '/review', '/soal', '/rangkuman'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Hanya tangani GET; POST/PUT dibiarkan lewat langsung (ditangani syncManager
  // di level aplikasi untuk offline queue, bukan di level Service Worker).
  if (request.method !== 'GET') {
    return;
  }

  // Cache API browser hanya menerima scheme http/https. Request dari ekstensi
  // browser (mis. chrome-extension://...) yang ikut lewat fetch event akan bikin
  // cache.put() throw "Request scheme ... is unsupported" kalau tetap dipaksa --
  // lewati saja, biarkan browser yang menangani request itu secara normal.
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return;
  }

  const isApiCall = API_GET_PREFIXES.some((prefix) => url.pathname.startsWith(prefix));

  if (isApiCall) {
    // Network-first untuk data API: coba jaringan lokal dulu, fallback ke cache.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // App shell (HTML/JS/CSS/asset statis): cache dulu kalau ada: kalau tidak
  // ada, fetch dari network LALU simpan ke cache supaya kunjungan berikutnya
  // (termasuk saat Local Server Hub mati total) tetap bisa boot dari cache.
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          // Hanya cache response sukses (hindari cache error page/opaque redirect).
          if (response && response.status === 200) {
            const cloned = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, cloned));
          }
          return response;
        })
        .catch(() => {
          // Benar-benar offline & belum ada di cache -- untuk navigasi HTML,
          // fallback ke '/' yang sudah pasti ter-precache saat install.
          if (request.mode === 'navigate') {
            return caches.match('/');
          }
          throw new Error('Asset tidak tersedia offline dan belum pernah di-cache.');
        });
    })
  );
});