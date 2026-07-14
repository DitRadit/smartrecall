/**
 * prefetchMateri.js - Unduh manual konten 1 materi (rangkuman, flashcard,
 * bank soal) ke cache offline (IndexedDB), dipicu tombol "Download" di
 * DaftarMateri.jsx (siswa).
 *
 * Kenapa perlu ini: sebelumnya cache HANYA terisi kalau siswa benar-benar
 * membuka halaman Rangkuman/ReviewFlashcard/KerjakanSoal masing-masing
 * (pola "network-first, populate on visit" di tiap halaman + service-worker).
 * Siswa yang cuma buka daftar materi lalu offline tidak akan punya
 * flashcard/rangkuman/soal tersimpan sama sekali. Fungsi di sini memanggil
 * endpoint yang SAMA PERSIS dengan yang dipanggil tiap halaman (supaya data
 * yang ter-cache konsisten dengan yang akan ditampilkan halaman itu), lalu
 * menyimpannya lewat helper cache yang sama (indexedDbCache.js) -- ini
 * bukan mekanisme cache baru, cuma memicu populate-nya lebih awal & sekaligus.
 */

import api from '../services/api';
import {
  cacheRangkuman,
  getCachedRangkuman,
  cacheFlashcards,
  getCachedFlashcards,
  cacheSoal,
  getCachedSoal,
} from './indexedDbCache';

/**
 * Unduh 1 materi untuk siswa tertentu. Tiap bagian (rangkuman/flashcard/soal)
 * gagal secara independen -- kegagalan salah satu (mis. rangkuman belum
 * di-generate) tidak menggagalkan bagian lain, sama seperti prinsip
 * graceful-degradation di generateAIContentInBackground (backend).
 */
export async function downloadMateriForOffline(materiId, siswaId) {
  const result = { rangkuman: false, flashcard: false, soal: false };

  await Promise.all([
    (async () => {
      try {
        const res = await api.get(`/rangkuman/materi/${materiId}`);
        await cacheRangkuman(Number(materiId), { judul: res.data.judul, konten: res.data.rangkuman.konten });
        result.rangkuman = Boolean(res.data.rangkuman?.konten);
      } catch (err) {
        // Rangkuman mungkin belum tersedia untuk materi ini -- bukan error fatal.
      }
    })(),
    (async () => {
      try {
        // Sengaja pakai /flashcard/materi/:id (SEMUA kartu published), BUKAN
        // /review/schedule -- endpoint schedule cuma balikin kartu yang due
        // atau belum pernah direview, jadi kalau siswa sudah mereview semua
        // kartu materi ini, hasilnya kosong walau kartunya tetap ada.
        const res = await api.get(`/flashcard/materi/${materiId}`);
        await cacheFlashcards(res.data.flashcards);
        result.flashcard = res.data.flashcards.length > 0;
      } catch (err) {
        // Gagal ambil flashcard -- lewati, jangan gagalkan bagian lain.
      }
    })(),
    (async () => {
      try {
        const res = await api.get(`/soal/materi/${materiId}`);
        await cacheSoal(Number(materiId), { judul: res.data.judul, soal: res.data.soal });
        result.soal = Array.isArray(res.data.soal) && res.data.soal.length > 0;
      } catch (err) {
        // Bank soal mungkin belum tersedia -- bukan error fatal.
      }
    })(),
  ]);

  return result;
}

/**
 * Cek apakah 1 materi SUDAH punya sesuatu tersimpan offline (dipakai untuk
 * badge "Tersedia Offline" saat daftar materi pertama kali dimuat).
 * Catatan: flashcard di-cache tanpa key per-materi (STORE_FLASHCARDS keyed
 * by id), jadi kita filter manual by materiId -- lihat getCachedFlashcards.
 */
export async function getMateriOfflineStatus(materiId) {
  const [rangkuman, flashcards, soal] = await Promise.all([
    getCachedRangkuman(Number(materiId)),
    getCachedFlashcards(Number(materiId)),
    getCachedSoal(Number(materiId)),
  ]);

  return {
    rangkuman: Boolean(rangkuman),
    flashcard: flashcards.length > 0,
    soal: Boolean(soal),
  };
}