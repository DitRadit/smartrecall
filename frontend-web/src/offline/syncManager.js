/**
 * syncManager.js - Mengelola offline queue submit review flashcard.
 *
 * Alur sesuai ARCHITECTURE.md bagian 3.2:
 *   Siswa submit skor -> jika koneksi ke backend-api OK -> POST langsung ke /review
 *   Jika koneksi terputus -> simpan ke offline queue (IndexedDB) -> sync manager
 *   retry otomatis saat koneksi kembali.
 *
 * Aturan penting: submit skor TIDAK BOLEH hilang walau koneksi terputus sesaat.
 */

import api from '../services/api';
import {
  enqueueReview,
  getQueuedReviews,
  removeQueuedReview,
  enqueueQuizSubmit,
  getQueuedQuizSubmits,
  removeQueuedQuizSubmit,
} from './indexedDbCache';

let isSyncing = false;

/**
 * Submit skor review. Coba langsung ke backend-api; jika gagal (offline atau
 * error jaringan), simpan ke offline queue untuk di-retry nanti.
 */
export async function submitReviewWithFallback(reviewPayload) {
  try {
    const response = await api.post('/review', reviewPayload);
    return { synced: true, data: response.data };
  } catch (err) {
    const isNetworkError = !err.response; // axios: tidak ada response = network/offline error
    if (isNetworkError) {
      await enqueueReview(reviewPayload);
      return { synced: false, queued: true };
    }
    // Error dari server (validasi dll) tetap dilempar, bukan network issue.
    throw err;
  }
}

/**
 * Submit hasil kuis. Coba langsung ke backend-api; jika gagal (offline atau
 * error jaringan), simpan ke offline queue untuk di-retry nanti. Pola sama
 * persis dengan submitReviewWithFallback (FR-13 offline support).
 */
export async function submitQuizWithFallback(quizPayload) {
  try {
    const response = await api.post('/soal/submit', quizPayload);
    return { synced: true, data: response.data };
  } catch (err) {
    const isNetworkError = !err.response;
    if (isNetworkError) {
      await enqueueQuizSubmit(quizPayload);
      return { synced: false, queued: true };
    }
    throw err;
  }
}

/**
 * Coba sync ulang semua item di offline queue. Dipanggil saat:
 * - Event 'online' browser terdeteksi
 * - Aplikasi baru dibuka (initial check)
 * - Secara berkala (polling ringan) sebagai jaring pengaman tambahan
 */
export async function trySyncQueue() {
  if (isSyncing) return; // hindari sync ganda berbarengan
  isSyncing = true;

  try {
    const queued = await getQueuedReviews();
    for (const item of queued) {
      try {
        const { localId, queuedAt, ...payload } = item;
        await api.post('/review', payload);
        await removeQueuedReview(localId);
        console.log(`[syncManager] berhasil sync review flashcard_id=${payload.flashcard_id} (queued at ${queuedAt})`);
      } catch (err) {
        if (!err.response) {
          // Masih offline / backend-api masih tidak terjangkau, hentikan loop,
          // coba lagi nanti.
          console.warn('[syncManager] masih offline, sync dihentikan sementara');
          break;
        }
        // Error validasi dari server: log tapi tetap lanjut ke item berikutnya
        // supaya satu item bermasalah tidak memblokir seluruh queue.
        console.error('[syncManager] gagal sync satu item, dilewati:', err.message);
        await removeQueuedReview(item.localId);
      }
    }

    const queuedQuiz = await getQueuedQuizSubmits();
    for (const item of queuedQuiz) {
      try {
        const { localId, queuedAt, ...payload } = item;
        await api.post('/soal/submit', payload);
        await removeQueuedQuizSubmit(localId);
        console.log(`[syncManager] berhasil sync hasil kuis materi_id=${payload.materi_id} (queued at ${queuedAt})`);
      } catch (err) {
        if (!err.response) {
          console.warn('[syncManager] masih offline, sync kuis dihentikan sementara');
          break;
        }
        console.error('[syncManager] gagal sync hasil kuis, dilewati:', err.message);
        await removeQueuedQuizSubmit(item.localId);
      }
    }
  } finally {
    isSyncing = false;
  }
}

/**
 * Pasang listener otomatis: setiap koneksi kembali online, coba sync queue.
 * Panggil sekali saat aplikasi pertama kali dimuat (lihat App.jsx).
 */
export function initSyncManager() {
  window.addEventListener('online', () => {
    console.log('[syncManager] koneksi kembali, mencoba sync offline queue...');
    trySyncQueue();
  });

  // Initial check saat app dibuka (barangkali ada sisa queue dari sesi sebelumnya)
  if (navigator.onLine) {
    trySyncQueue();
  }

  // Jaring pengaman: polling ringan tiap 30 detik selama app terbuka.
  setInterval(() => {
    if (navigator.onLine) {
      trySyncQueue();
    }
  }, 30000);
}
