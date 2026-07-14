import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSyncManager } from './offline/syncManager';

// Registrasi Service Worker untuk offline-first (ARCHITECTURE.md bagian 1 & 3.2).
// Hanya didaftarkan di sisi siswa/guru browser; tidak memengaruhi backend-api/ai-service.
// PENTING: hanya di production build (import.meta.env.PROD). Saat development (`npm run
// dev`), Vite men-serve module lewat path khusus (/@vite/client, /@react-refresh, /src/*.jsx
// sebagai ES module langsung) yang TIDAK boleh diintersep Service Worker -- kalau SW ikut
// menangkap fetch untuk path-path itu, request-nya gagal (net::ERR_FAILED) dan app jadi
// blank putih total, karena HMR client & entry module gak pernah ke-load.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/service-worker.js')
      .then(() => console.log('Service worker terdaftar.'))
      .catch((err) => console.warn('Gagal mendaftarkan service worker:', err));
  });
}

// Inisialisasi sync manager: otomatis retry offline queue saat koneksi kembali.
initSyncManager();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);